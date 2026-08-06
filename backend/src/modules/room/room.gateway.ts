import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from './room.service';
import { QuizService } from '../quiz/quiz.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RoomGateway.name);

  constructor(
    private roomService: RoomService,
    private quizService: QuizService,
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (token) {
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'cognition-super-secret-jwt-key-2026',
        });
        client.data.user = payload;
        this.logger.log(`Authenticated Socket connected: ${client.id} (User: ${payload.email}, Role: ${payload.role})`);
      } else {
        this.logger.log(`Anonymous Socket connected: ${client.id}`);
      }
    } catch (err: any) {
      this.logger.warn(`Socket authentication failed for ${client.id}: ${err.message}`);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
    const result = await this.roomService.handlePlayerDisconnect(client.id);
    if (result) {
      const { pin, player } = result;
      // Notify host and other players about disconnection
      this.server.to(`room:${pin}`).emit('player_left', {
        name: player.name,
        socketId: client.id,
      });
      // Broadcast updated lobby list
      const players = await this.roomService.getPlayers(pin);
      this.server.to(`room:${pin}`).emit('lobby_update', players);
    }
  }

  // HOST: Create Room
  @SubscribeMessage('host_create_room')
  async handleCreateRoom(
    @MessageBody() data: { quizId: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Host ${data.hostId} creating room for quiz ${data.quizId}`);
      const session = await this.roomService.createRoom(data.quizId, data.hostId);
      
      // Join host socket room
      client.join(`room:${session.pin}`);
      client.join(`host:${session.pin}`);

      client.emit('room_created', {
        pin: session.pin,
        sessionId: session.id,
        quiz: session.quiz,
      });
    } catch (error) {
      client.emit('error', { message: error.message || 'Failed to create room' });
    }
  }

  // PLAYER: Join Room
  @SubscribeMessage('player_join')
  async handlePlayerJoin(
    @MessageBody() data: { pin: string; name: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, name } = data;
      this.logger.log(`Player ${name} trying to join pin ${pin}`);

      const player = await this.roomService.joinPlayer(pin, name, client.id);
      
      // Join general room
      client.join(`room:${pin}`);

      // Acknowledge join success
      client.emit('join_success', {
        player: {
          id: player.id,
          name: player.name,
          score: player.score,
          streak: player.streak,
        },
      });

      // Broadcast updated player list
      const players = await this.roomService.getPlayers(pin);
      this.server.to(`room:${pin}`).emit('lobby_update', players);
    } catch (error) {
      client.emit('join_error', { message: error.message || 'Failed to join room' });
    }
  }

  // HOST: Start Game
  @SubscribeMessage('host_start_game')
  async handleStartGame(
    @MessageBody() data: { pin: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin } = data;
      const room = await this.roomService.getRoomState(pin);
      if (!room) throw new Error('Room not found');

      room.status = 'PLAYING';
      await this.roomService.setRoomState(pin, room);

      // Notify clients
      this.server.to(`room:${pin}`).emit('game_started');

      // Trigger first question
      await this.triggerQuestion(pin, room);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  // Trigger countdown and active state of a question
  private async triggerQuestion(pin: string, room: any) {
    const quiz = await this.quizService.getQuizById(room.quizId);
    const question = quiz.questions[room.currentQuestionIdx];

    if (!question) {
      await this.endQuiz(pin);
      return;
    }

    room.status = 'PLAYING';
    room.currentQuestionId = question.id;
    room.timeLeft = question.timeLimit;
    await this.roomService.setRoomState(pin, room);

    // Prepare question data (Exclude correct flags for participants)
    const participantQuestion = {
      id: question.id,
      text: question.text,
      type: question.type,
      order: question.order,
      points: question.points,
      timeLimit: question.timeLimit,
      imageUrl: question.imageUrl,
      options: question.options.map(o => ({ id: o.id, text: o.text })), // Hide correctness
    };

    const hostQuestion = {
      ...question,
      options: question.options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect === 'true' })),
    };

    // Emit specialized payloads to maintain anti-cheat boundaries
    this.server.to(`host:${pin}`).emit('host_question_start', hostQuestion);
    this.server.to(`room:${pin}`).except(`host:${pin}`).emit('question_start', participantQuestion);

    // Start ticker
    await this.roomService.startQuestionTimer(
      pin,
      (timeLeft) => {
        this.server.to(`room:${pin}`).emit('timer_tick', { timeLeft });
      },
      async () => {
        await this.revealAnswers(pin, question.id);
      },
    );
  }

  // Automatically reveal answer when timer completes
  private async revealAnswers(pin: string, questionId: string) {
    this.roomService.clearTimer(pin);

    const room = await this.roomService.getRoomState(pin);
    if (!room) return;

    room.status = 'REVEAL_ANSWER';
    await this.roomService.setRoomState(pin, room);

    const stats = await this.roomService.getQuestionStats(pin, questionId);

    // Broadcast stats and correct answers
    this.server.to(`room:${pin}`).emit('answer_revealed', stats);
  }

  // PLAYER: Submit Answer
  @SubscribeMessage('submit_answer')
  async handleSubmitAnswer(
    @MessageBody() data: { pin: string; name: string; questionId: string; optionId?: string; textResponse?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, name, questionId, optionId, textResponse } = data;
      const result = await this.roomService.submitResponse(pin, name, questionId, optionId, textResponse);

      if (result.duplicate) {
        client.emit('error', { message: 'Answer already submitted for this question' });
        return;
      }

      // Send private validation to the client
      client.emit('answer_acknowledged', {
        isCorrect: result.isCorrect,
        pointsEarned: result.pointsEarned,
        newScore: result.newScore,
        newStreak: result.newStreak,
      });

      // Notify host of activity (for live statistics bars)
      const room = await this.roomService.getRoomState(pin);
      if (room) {
        const stats = await this.roomService.getQuestionStats(pin, questionId);
        this.server.to(`host:${pin}`).emit('host_responses_update', stats);
      }
    } catch (error) {
      client.emit('error', { message: error.message || 'Failed to record response' });
    }
  }

  // HOST: Manually Skip or Move to Next Question
  @SubscribeMessage('host_next_question')
  async handleNextQuestion(
    @MessageBody() data: { pin: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin } = data;
      const room = await this.roomService.getRoomState(pin);
      if (!room) throw new Error('Room not found');

      // Clear existing timer if moving ahead early
      this.roomService.clearTimer(pin);

      if (room.status === 'REVEAL_ANSWER') {
        // Go to LEADERBOARD step
        room.status = 'LEADERBOARD';
        await this.roomService.setRoomState(pin, room);

        const players = await this.roomService.getPlayers(pin);
        this.server.to(`room:${pin}`).emit('leaderboard_update', players);
      } else if (room.status === 'LEADERBOARD') {
        // Move to the next question
        room.currentQuestionIdx++;
        if (room.currentQuestionIdx >= room.questionsCount) {
          await this.endQuiz(pin);
        } else {
          await this.triggerQuestion(pin, room);
        }
      } else {
        // Fallback or force next
        await this.triggerQuestion(pin, room);
      }
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  private async endQuiz(pin: string) {
    const room = await this.roomService.getRoomState(pin);
    if (!room) return;

    room.status = 'FINISHED';
    await this.roomService.setRoomState(pin, room);

    // Update database status
    await this.prisma.quizSession.update({
      where: { id: room.sessionId },
      data: { status: 'FINISHED' },
    });

    const players = await this.roomService.getPlayers(pin);
    
    // Broadcast winner celebration sequence (top 3 players)
    const podium = players.slice(0, 3);
    this.server.to(`room:${pin}`).emit('winner_celebration', {
      podium,
      players,
    });
  }

  // Real-time Chat
  @SubscribeMessage('send_chat')
  async handleChat(
    @MessageBody() data: { pin: string; name: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { pin, name, message } = data;
    this.server.to(`room:${pin}`).emit('chat_message', {
      name,
      message,
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  // Real-time reactions (emojis)
  @SubscribeMessage('send_reaction')
  async handleReaction(
    @MessageBody() data: { pin: string; emoji: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { pin, emoji } = data;
    // Broadcast reaction to room
    this.server.to(`room:${pin}`).emit('new_reaction', { emoji });
  }
}

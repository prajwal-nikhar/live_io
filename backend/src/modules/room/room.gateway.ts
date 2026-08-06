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
        this.logger.log(`Authenticated Socket connected: ${client.id} (${payload.email})`);
      } else {
        this.logger.log(`Anonymous Socket connected: ${client.id}`);
      }
    } catch (err: any) {
      this.logger.warn(`Socket auth check: ${err.message}`);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
    const result = await this.roomService.handlePlayerDisconnect(client.id);
    if (result) {
      const { pin, player } = result;
      this.server.to(`room:${pin}`).emit('player:left', {
        name: player.name,
        socketId: client.id,
      });
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

      client.join(`room:${session.pin}`);
      client.join(`host:${session.pin}`);

      client.emit('room_created', {
        pin: session.pin,
        sessionId: session.id,
        quiz: session.quiz,
      });
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to create room' });
    }
  }

  // PLAYER: Join Room (Lobby Registration)
  @SubscribeMessage('player:join')
  @SubscribeMessage('player_join')
  async handlePlayerJoin(
    @MessageBody() data: { pin: string; name: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, name } = data;
      this.logger.log(`Player ${name} joining room ${pin}`);

      const player = await this.roomService.joinPlayer(pin, name, client.id);

      client.join(`room:${pin}`);

      // Emit join confirmation with reconnectToken
      client.emit('player:joined', {
        player: {
          id: player.id,
          name: player.name,
          score: player.score,
          streak: player.streak,
          reconnectToken: player.reconnectToken,
        },
      });

      // Backward compatibility event
      client.emit('join_success', {
        player: {
          id: player.id,
          name: player.name,
          score: player.score,
          streak: player.streak,
          reconnectToken: player.reconnectToken,
        },
      });

      // Broadcast updated lobby list
      const players = await this.roomService.getPlayers(pin);
      this.server.to(`room:${pin}`).emit('lobby_update', players);
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to join room' });
    }
  }

  // PLAYER: Dedicated Reconnect Handler (Kahoot / Quizizz Reconnect Engine)
  @SubscribeMessage('player:reconnect')
  async handlePlayerReconnect(
    @MessageBody() data: { pin: string; playerId: string; reconnectToken: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, playerId, reconnectToken } = data;
      this.logger.log(`Player ${playerId} requesting reconnect for pin ${pin}`);

      const { player, syncState } = await this.roomService.reconnectPlayer(
        pin,
        playerId,
        reconnectToken,
        client.id,
      );

      client.join(`room:${pin}`);

      client.emit('player:reconnected', {
        player: {
          id: player.id,
          name: player.name,
          score: player.score,
          streak: player.streak,
          reconnectToken: player.reconnectToken,
        },
        syncState,
      });

      // Send full state synchronization
      client.emit('session:sync', syncState);

      // Update lobby if in LOBBY status
      const players = await this.roomService.getPlayers(pin);
      this.server.to(`room:${pin}`).emit('lobby_update', players);
    } catch (error: any) {
      this.logger.warn(`Player reconnect rejected for pin ${data.pin}: ${error.message}`);
      client.emit('reconnect:failed', { message: error.message });
    }
  }

  // PLAYER: Explicit State Synchronization
  @SubscribeMessage('player:sync')
  async handlePlayerSync(
    @MessageBody() data: { pin: string; playerId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const syncState = await this.roomService.getSyncState(data.pin, data.playerId);
      if (syncState) {
        client.emit('session:sync', syncState);
      }
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to sync session state' });
    }
  }

  // HOST: Start Quiz
  @SubscribeMessage('host:start')
  @SubscribeMessage('host_start_quiz')
  async handleStartQuiz(
    @MessageBody() data: { pin: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, hostId } = data;
      this.logger.log(`Host starting quiz for room ${pin}`);

      const { question, remainingSeconds } = await this.roomService.startQuiz(pin, hostId);

      const syncState = await this.roomService.getSyncState(pin);

      // Broadcast question start event
      this.server.to(`room:${pin}`).emit('question:start', {
        question,
        remainingSeconds,
        questionIndex: 0,
        totalQuestions: syncState?.totalQuestions || 1,
      });

      this.server.to(`room:${pin}`).emit('quiz_started', {
        question,
        remainingSeconds,
        questionIndex: 0,
      });

      this.server.to(`room:${pin}`).emit('session:sync', syncState);
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to start quiz' });
    }
  }

  // HOST: Skip Question (Immediately halts timer, locks responses, advances to answer reveal)
  @SubscribeMessage('host:skip')
  @SubscribeMessage('host_skip_question')
  async handleSkipQuestion(
    @MessageBody() data: { pin: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, hostId } = data;
      this.logger.log(`Host skipping question for pin ${pin}`);

      const { stats } = await this.roomService.skipQuestion(pin, hostId);
      const syncState = await this.roomService.getSyncState(pin);

      this.server.to(`room:${pin}`).emit('question:skip', {
        pin,
        stats,
      });

      this.server.to(`room:${pin}`).emit('session:sync', syncState);
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to skip question' });
    }
  }

  // HOST: Show Answer (Stops timer, reveals correct options & stats)
  @SubscribeMessage('host:showAnswer')
  @SubscribeMessage('host_show_answer')
  async handleShowAnswer(
    @MessageBody() data: { pin: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, hostId } = data;
      this.logger.log(`Host revealing answer for pin ${pin}`);

      const { stats, leaderboard } = await this.roomService.showAnswer(pin, hostId);
      const syncState = await this.roomService.getSyncState(pin);

      this.server.to(`room:${pin}`).emit('answer:reveal', {
        pin,
        stats,
        leaderboard,
      });

      this.server.to(`room:${pin}`).emit('show_answer', {
        stats,
        leaderboard,
      });

      this.server.to(`room:${pin}`).emit('session:sync', syncState);
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to show answer' });
    }
  }

  // HOST: Show Leaderboard
  @SubscribeMessage('host:showLeaderboard')
  @SubscribeMessage('host_show_leaderboard')
  async handleShowLeaderboard(
    @MessageBody() data: { pin: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, hostId } = data;
      const { leaderboard } = await this.roomService.showLeaderboard(pin, hostId);
      const syncState = await this.roomService.getSyncState(pin);

      this.server.to(`room:${pin}`).emit('leaderboard:update', { leaderboard });
      this.server.to(`room:${pin}`).emit('session:sync', syncState);
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to show leaderboard' });
    }
  }

  // HOST: Next Question
  @SubscribeMessage('host:next')
  @SubscribeMessage('host_next_question')
  async handleNextQuestion(
    @MessageBody() data: { pin: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, hostId } = data;
      const result = await this.roomService.nextQuestion(pin, hostId);

      if (result.finished) {
        this.server.to(`room:${pin}`).emit('quiz:finished', {
          leaderboard: result.leaderboard,
        });
        this.server.to(`room:${pin}`).emit('quiz_finished', {
          leaderboard: result.leaderboard,
        });
      } else {
        const syncState = await this.roomService.getSyncState(pin);

        this.server.to(`room:${pin}`).emit('question:start', {
          question: result.question,
          questionIndex: result.questionIndex,
          totalQuestions: result.totalQuestions,
          remainingSeconds: result.remainingSeconds,
        });

        this.server.to(`room:${pin}`).emit('session:sync', syncState);
      }
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to advance question' });
    }
  }

  // PLAYER: Answer Question
  @SubscribeMessage('player:answer')
  @SubscribeMessage('player_submit_answer')
  async handleSubmitAnswer(
    @MessageBody()
    data: {
      pin: string;
      playerId: string;
      questionId: string;
      optionId: string;
      textResponse?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { pin, playerId, questionId, optionId, textResponse } = data;
      this.logger.log(`Player ${playerId} submitting answer for question ${questionId}`);

      const result = await this.roomService.submitResponse(
        pin,
        playerId,
        questionId,
        optionId,
        textResponse,
      );

      if (result.duplicate) {
        client.emit('answer:acknowledged', { duplicate: true });
        return;
      }

      client.emit('answer:acknowledged', {
        duplicate: false,
        isCorrect: result.isCorrect,
        pointsEarned: result.pointsEarned,
        newScore: result.newScore,
        newStreak: result.newStreak,
      });

      // Broadcast answer count progress to Host
      const stats = await this.roomService.getQuestionStats(pin, questionId);
      this.server.to(`host:${pin}`).emit('answer:progress', {
        totalResponses: stats?.totalResponses || 0,
      });
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to submit answer' });
    }
  }
}

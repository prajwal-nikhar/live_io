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

export interface AckResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

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
        this.logger.log(`[Socket Connected] ID: ${client.id} (User: ${payload.email})`);
      } else {
        this.logger.log(`[Socket Connected] ID: ${client.id} (Anonymous)`);
      }
    } catch (err: any) {
      this.logger.warn(`[Socket Auth Check Failed] ID: ${client.id} Reason: ${err.message}`);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`[Socket Disconnected] ID: ${client.id}`);
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

  // HOST: Create Room (Supports Acknowledgement Callback)
  @SubscribeMessage('host_create_room')
  @SubscribeMessage('host:create_room')
  async handleCreateRoom(
    @MessageBody() data: { quizId: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      this.logger.log(`[Join Requested] Host ${data.hostId} creating room for quiz ${data.quizId}`);
      const session = await this.roomService.createRoom(data.quizId, data.hostId);

      client.join(`room:${session.pin}`);
      client.join(`host:${session.pin}`);

      const payload = {
        pin: session.pin,
        sessionId: session.id,
        quiz: session.quiz,
      };

      // Broadcast legacy event for backward compatibility
      client.emit('room_created', payload);

      this.logger.log(`[Room Created] PIN: ${session.pin} SessionId: ${session.id}`);
      return { success: true, data: payload };
    } catch (error: any) {
      this.logger.error(`[Room Creation Failed] ${error.message}`);
      client.emit('error', { message: error.message || 'Failed to create room' });
      return { success: false, message: error.message || 'Failed to create room' };
    }
  }

  // PLAYER: Join Room (Supports Acknowledgement Callback)
  @SubscribeMessage('player:join')
  @SubscribeMessage('player_join')
  async handlePlayerJoin(
    @MessageBody() data: { pin: string; name: string },
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const { pin, name } = data;
      this.logger.log(`[Join Requested] Player '${name}' requesting join for PIN ${pin}`);

      const player = await this.roomService.joinPlayer(pin, name, client.id);
      client.join(`room:${pin}`);

      const responsePayload = {
        player: {
          id: player.id,
          name: player.name,
          score: player.score,
          streak: player.streak,
          reconnectToken: player.reconnectToken,
        },
      };

      // Emit legacy events for backward compatibility
      client.emit('player:joined', responsePayload);
      client.emit('join_success', responsePayload);

      // Broadcast updated lobby list to room
      const players = await this.roomService.getPlayers(pin);
      this.server.to(`room:${pin}`).emit('lobby_update', players);

      this.logger.log(`[Join Success] Player '${name}' (${player.id}) joined PIN ${pin}`);
      return { success: true, data: responsePayload };
    } catch (error: any) {
      this.logger.warn(`[Join Failed] Player '${data?.name}' PIN ${data?.pin}: ${error.message}`);
      client.emit('error', { message: error.message || 'Failed to join room' });
      return { success: false, message: error.message || 'Failed to join room' };
    }
  }

  // PLAYER: Dedicated Reconnect Handler (Supports Acknowledgement Callback)
  @SubscribeMessage('player:reconnect')
  async handlePlayerReconnect(
    @MessageBody() data: { pin: string; playerId: string; reconnectToken: string },
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const { pin, playerId, reconnectToken } = data;
      this.logger.log(`[Reconnect Requested] Player ${playerId} for PIN ${pin}`);

      const { player, syncState } = await this.roomService.reconnectPlayer(
        pin,
        playerId,
        reconnectToken,
        client.id,
      );

      client.join(`room:${pin}`);

      const responsePayload = {
        player: {
          id: player.id,
          name: player.name,
          score: player.score,
          streak: player.streak,
          reconnectToken: player.reconnectToken,
        },
        syncState,
      };

      client.emit('player:reconnected', responsePayload);
      client.emit('session:sync', syncState);

      const players = await this.roomService.getPlayers(pin);
      this.server.to(`room:${pin}`).emit('lobby_update', players);

      this.logger.log(`[Reconnect Success] Player '${player.name}' restored for PIN ${pin}`);
      return { success: true, data: responsePayload };
    } catch (error: any) {
      this.logger.warn(`[Reconnect Failed] PIN ${data?.pin}: ${error.message}`);
      client.emit('reconnect:failed', { message: error.message });
      return { success: false, message: error.message || 'Failed to reconnect' };
    }
  }

  // PLAYER: Explicit State Synchronization (Supports Acknowledgement Callback)
  @SubscribeMessage('player:sync')
  async handlePlayerSync(
    @MessageBody() data: { pin: string; playerId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const syncState = await this.roomService.getSyncState(data.pin, data.playerId);
      if (syncState) {
        client.emit('session:sync', syncState);
        return { success: true, data: syncState };
      }
      return { success: false, message: 'Room or session state not found' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to sync session state' };
    }
  }

  // HOST: Start Quiz (Supports Acknowledgement Callback & Canonical host:start)
  @SubscribeMessage('host:start')
  @SubscribeMessage('host_start_quiz')
  @SubscribeMessage('host_start_game')
  async handleStartQuiz(
    @MessageBody() data: { pin: string; hostId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const pin = data.pin;
      const hostId = data.hostId || client.data.user?.id;
      this.logger.log(`[Host Action] Start quiz for PIN ${pin} (Host: ${hostId || 'anonymous'})`);

      const { question, remainingSeconds } = await this.roomService.startQuiz(pin, hostId);
      const syncState = await this.roomService.getSyncState(pin);

      const payload = {
        question,
        remainingSeconds,
        questionIndex: 0,
        totalQuestions: syncState?.totalQuestions || 1,
      };

      // Broadcast canonical and legacy events to room
      this.server.to(`room:${pin}`).emit('question:start', payload);
      this.server.to(`room:${pin}`).emit('quiz_started', payload);
      this.server.to(`room:${pin}`).emit('session:sync', syncState);

      this.logger.log(`[Participants Acknowledged] Broadcasted question:start to room:${pin}`);
      this.logger.log(`[Host Acknowledged] Successfully started quiz for PIN ${pin}`);

      return { success: true, data: { question, remainingSeconds, syncState } };
    } catch (error: any) {
      this.logger.error(`[Start Quiz Failed] PIN ${data?.pin}: ${error.message}`);
      client.emit('error', { message: error.message || 'Failed to start quiz' });
      return { success: false, message: error.message || 'Failed to start quiz' };
    }
  }

  // HOST: Skip Question (Supports Acknowledgement Callback)
  @SubscribeMessage('host:skip')
  @SubscribeMessage('host_skip_question')
  async handleSkipQuestion(
    @MessageBody() data: { pin: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const { pin, hostId } = data;
      this.logger.log(`[Host Action] Skip question for PIN ${pin}`);

      const { stats } = await this.roomService.skipQuestion(pin, hostId);
      const syncState = await this.roomService.getSyncState(pin);

      this.server.to(`room:${pin}`).emit('question:skip', {
        pin,
        stats,
      });

      this.server.to(`room:${pin}`).emit('session:sync', syncState);

      return { success: true, data: { stats, syncState } };
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to skip question' });
      return { success: false, message: error.message || 'Failed to skip question' };
    }
  }

  // HOST: Show Answer (Supports Acknowledgement Callback)
  @SubscribeMessage('host:showAnswer')
  @SubscribeMessage('host_show_answer')
  async handleShowAnswer(
    @MessageBody() data: { pin: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const { pin, hostId } = data;
      this.logger.log(`[Host Action] Show answer for PIN ${pin}`);

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

      return { success: true, data: { stats, leaderboard, syncState } };
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to show answer' });
      return { success: false, message: error.message || 'Failed to show answer' };
    }
  }

  // HOST: Show Leaderboard (Supports Acknowledgement Callback)
  @SubscribeMessage('host:showLeaderboard')
  @SubscribeMessage('host_show_leaderboard')
  async handleShowLeaderboard(
    @MessageBody() data: { pin: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const { pin, hostId } = data;
      const { leaderboard } = await this.roomService.showLeaderboard(pin, hostId);
      const syncState = await this.roomService.getSyncState(pin);

      this.server.to(`room:${pin}`).emit('leaderboard:update', { leaderboard });
      this.server.to(`room:${pin}`).emit('session:sync', syncState);

      return { success: true, data: { leaderboard, syncState } };
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to show leaderboard' });
      return { success: false, message: error.message || 'Failed to show leaderboard' };
    }
  }

  // HOST: Next Question (Supports Acknowledgement Callback)
  @SubscribeMessage('host:next')
  @SubscribeMessage('host_next_question')
  async handleNextQuestion(
    @MessageBody() data: { pin: string; hostId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
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
        return { success: true, data: { finished: true, leaderboard: result.leaderboard } };
      } else {
        const syncState = await this.roomService.getSyncState(pin);

        this.server.to(`room:${pin}`).emit('question:start', {
          question: result.question,
          questionIndex: result.questionIndex,
          totalQuestions: result.totalQuestions,
          remainingSeconds: result.remainingSeconds,
        });

        this.server.to(`room:${pin}`).emit('session:sync', syncState);

        return {
          success: true,
          data: {
            finished: false,
            question: result.question,
            remainingSeconds: result.remainingSeconds,
            syncState,
          },
        };
      }
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to advance question' });
      return { success: false, message: error.message || 'Failed to advance question' };
    }
  }

  // PLAYER: Answer Question (Supports Acknowledgement Callback)
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
  ): Promise<AckResult> {
    try {
      const { pin, playerId, questionId, optionId, textResponse } = data;
      this.logger.log(`[Answer Submission] Player ${playerId} question ${questionId}`);

      const result = await this.roomService.submitResponse(
        pin,
        playerId,
        questionId,
        optionId,
        textResponse,
      );

      if (result.duplicate) {
        client.emit('answer:acknowledged', { duplicate: true });
        return { success: true, data: { duplicate: true } };
      }

      const responsePayload = {
        duplicate: false,
        isCorrect: result.isCorrect,
        pointsEarned: result.pointsEarned,
        newScore: result.newScore,
        newStreak: result.newStreak,
      };

      client.emit('answer:acknowledged', responsePayload);

      const stats = await this.roomService.getQuestionStats(pin, questionId);
      this.server.to(`host:${pin}`).emit('answer:progress', {
        totalResponses: stats?.totalResponses || 0,
      });

      return { success: true, data: responsePayload };
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to submit answer' });
      return { success: false, message: error.message || 'Failed to submit answer' };
    }
  }
}

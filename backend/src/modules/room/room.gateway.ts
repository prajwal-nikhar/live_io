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
import { MetricsService } from '../metrics/metrics.service';
import { Logger, UseGuards as UseGuardsCommon } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsThrottlerGuard } from '../../common/guards/ws-throttler.guard';
import { WsValidationPipe } from '../../common/pipes/ws-validation.pipe';
import { sanitizeInput } from '../../common/utils/sanitization.util';
import {
  JoinRoomDto,
  SubmitAnswerDto,
  CreateRoomDto,
  StartQuizDto,
  ReconnectPlayerDto,
  HostActionDto,
} from './dto/room.dtos';

export interface AckResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 10000,
  maxHttpBufferSize: 1e6,
  allowEIO3: true,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
})
@UseGuardsCommon(WsThrottlerGuard)
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RoomGateway.name);
  private readonly wsValidationPipe = new WsValidationPipe();

  constructor(
    private roomService: RoomService,
    private quizService: QuizService,
    private prisma: PrismaService,
    private jwtService: JwtService,
    private metricsService: MetricsService,
  ) {}

  private parsePayload(data: any): any {
    if (!data) return {};
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return {};
      }
    }
    return data;
  }

  private async validatePayload<T extends object>(dtoClass: new () => T, data: any): Promise<T> {
    const parsed = this.parsePayload(data);
    return await this.wsValidationPipe.transform(parsed, { type: 'body', metatype: dtoClass });
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (token) {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret && process.env.NODE_ENV === 'production') {
          throw new Error('CRITICAL: JWT_SECRET environment variable is missing');
        }
        const payload = this.jwtService.verify(token, {
          secret: jwtSecret || 'dev-fallback-secret-key-change-in-prod',
        });
        client.data.user = payload;
        this.logger.log(`[Socket Connected] ID: ${client.id} (User: ${payload.email})`);
      } else {
        this.logger.log(`[Socket Connected] ID: ${client.id} (Anonymous)`);
      }

      this.metricsService.activeSocketsGauge.inc();
    } catch (err: any) {
      this.logger.warn(`[Socket Auth Check Failed] ID: ${client.id} Reason: ${err.message}`);
      this.metricsService.activeSocketsGauge.inc();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`[Socket Disconnected] ID: ${client.id}`);
    this.metricsService.activeSocketsGauge.dec();

    const result = await this.roomService.handlePlayerDisconnect(client.id);
    if (result) {
      const { pin, player } = result;
      this.server.to(`room:${pin}`).emit('player:left', {
        name: player.name,
        socketId: client.id,
      });
      this.scheduleLobbyUpdate(pin);
    }
  }

  // HOST: Create Room
  @SubscribeMessage('host_create_room')
  @SubscribeMessage('host:create_room')
  async handleCreateRoom(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const dto = await this.validatePayload(CreateRoomDto, data);
      this.logger.log(`[Host Action] Host ${dto.hostId} creating room for quiz ${dto.quizId} (Socket: ${client.id})`);
      const session = await this.roomService.createRoom(dto.quizId, dto.hostId);

      client.join(`room:${session.pin}`);
      client.join(`host:${session.pin}`);

      const payload = {
        pin: session.pin,
        sessionId: session.id,
        quiz: session.quiz,
      };

      client.emit('room_created', payload);
      this.metricsService.activeRoomsGauge.inc();

      this.logger.log(`[Room Created] PIN: ${session.pin} SessionId: ${session.id}`);
      return { success: true, data: payload };
    } catch (error: any) {
      this.logger.error(`[Room Creation Failed] ${error.message}`);
      client.emit('error', { message: error.message || 'Failed to create room' });
      return { success: false, message: error.message || 'Failed to create room' };
    }
  }

  private lobbyDebounceTimers = new Map<string, NodeJS.Timeout>();

  private scheduleLobbyUpdate(pin: string) {
    if (this.lobbyDebounceTimers.has(pin)) return;

    const timer = setTimeout(async () => {
      this.lobbyDebounceTimers.delete(pin);
      try {
        const timerStart = Date.now();
        const players = await this.roomService.getPlayers(pin);
        this.server.to(`room:${pin}`).emit('lobby_update', players);
        this.metricsService.broadcastLatencyHistogram.observe((Date.now() - timerStart) / 1000);
      } catch (err: any) {
        this.logger.error(`[Lobby Update Broadcast Error] PIN ${pin}: ${err.message}`);
      }
    }, 250);

    this.lobbyDebounceTimers.set(pin, timer);
  }

  // PLAYER: Join Room
  @SubscribeMessage('player:join')
  @SubscribeMessage('player_join')
  async handleJoinRoom(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    const startTime = Date.now();
    try {
      const dto = await this.validatePayload(JoinRoomDto, data);
      const pin = dto.pin;
      const sanitizedName = sanitizeInput(dto.name);
      this.logger.log(`[Join Requested] Player '${sanitizedName}' requesting join for PIN ${pin} (Socket: ${client.id})`);

      const player = await this.roomService.joinPlayer(pin, sanitizedName, client.id);
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

      client.emit('player:joined', responsePayload);
      client.emit('join_success', responsePayload);

      this.scheduleLobbyUpdate(pin);
      this.metricsService.connectedPlayersGauge.inc();
      this.metricsService.joinLatencyHistogram.observe((Date.now() - startTime) / 1000);

      this.logger.log(`[Join Success] Player '${sanitizedName}' (${player.id}) joined PIN ${pin}`);
      return { success: true, data: responsePayload };
    } catch (error: any) {
      this.logger.warn(`[Join Failed] Socket ${client.id}: ${error.message}`);
      client.emit('error', { message: error.message || 'Failed to join room' });
      return { success: false, message: error.message || 'Failed to join room' };
    }
  }

  // PLAYER: Dedicated Reconnect Handler
  @SubscribeMessage('player:reconnect')
  async handlePlayerReconnect(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const dto = await this.validatePayload(ReconnectPlayerDto, data);
      const { pin, playerId, reconnectToken } = dto;
      this.logger.log(`[Reconnect Requested] Player ${playerId} for PIN ${pin} (Socket: ${client.id})`);

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

      this.scheduleLobbyUpdate(pin);
      this.metricsService.connectedPlayersGauge.inc();

      this.logger.log(`[Reconnect Success] Player '${player.name}' restored for PIN ${pin}`);
      return { success: true, data: responsePayload };
    } catch (error: any) {
      this.logger.warn(`[Reconnect Failed] Socket ${client.id}: ${error.message}`);
      client.emit('reconnect:failed', { message: error.message });
      return { success: false, message: error.message || 'Failed to reconnect' };
    }
  }

  // PLAYER: Explicit State Synchronization
  @SubscribeMessage('player:sync')
  async handlePlayerSync(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const parsed = this.parsePayload(data);
      const syncState = await this.roomService.getSyncState(parsed?.pin, parsed?.playerId);
      if (syncState) {
        client.emit('session:sync', syncState);
        return { success: true, data: syncState };
      }
      return { success: false, message: 'Room or session state not found' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to sync session state' };
    }
  }

  // HOST: Start Quiz
  @SubscribeMessage('host:start')
  @SubscribeMessage('host_start_quiz')
  @SubscribeMessage('host_start_game')
  async handleStartQuiz(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const dto = await this.validatePayload(StartQuizDto, data);
      const pin = dto.pin;
      const hostId = dto.hostId || client.data.user?.id;
      this.logger.log(`[Host Action] Start quiz for PIN ${pin} (Host: ${hostId || 'anonymous'}, Socket: ${client.id})`);

      const { question, remainingSeconds } = await this.roomService.startQuiz(pin, hostId);
      const syncState = await this.roomService.getSyncState(pin);

      const responsePayload = {
        question,
        remainingSeconds,
        questionIndex: 0,
        totalQuestions: syncState?.totalQuestions || 1,
      };

      const timerStart = Date.now();
      this.server.to(`room:${pin}`).emit('question:start', responsePayload);
      this.server.to(`room:${pin}`).emit('quiz_started', responsePayload);
      this.server.to(`room:${pin}`).emit('session:sync', syncState);
      this.metricsService.broadcastLatencyHistogram.observe((Date.now() - timerStart) / 1000);

      this.logger.log(`[Host Acknowledged] Successfully started quiz for PIN ${pin}`);
      return { success: true, data: { question, remainingSeconds, syncState } };
    } catch (error: any) {
      this.logger.error(`[Start Quiz Failed] Socket ${client.id}: ${error.message}`);
      client.emit('error', { message: error.message || 'Failed to start quiz' });
      return { success: false, message: error.message || 'Failed to start quiz' };
    }
  }

  // HOST: Skip Question
  @SubscribeMessage('host:skip')
  @SubscribeMessage('host_skip_question')
  async handleSkipQuestion(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const dto = await this.validatePayload(HostActionDto, data);
      const { pin, hostId } = dto;
      this.logger.log(`[Host Action] Skip question for PIN ${pin} (Socket: ${client.id})`);

      const { stats } = await this.roomService.skipQuestion(pin, hostId || 'host_id_default');
      const syncState = await this.roomService.getSyncState(pin);

      this.server.to(`room:${pin}`).emit('question:skip', { pin, stats });
      this.server.to(`room:${pin}`).emit('session:sync', syncState);

      return { success: true, data: { stats, syncState } };
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to skip question' });
      return { success: false, message: error.message || 'Failed to skip question' };
    }
  }

  // HOST: Show Answer
  @SubscribeMessage('host:showAnswer')
  @SubscribeMessage('host_show_answer')
  async handleShowAnswer(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const dto = await this.validatePayload(HostActionDto, data);
      const { pin, hostId } = dto;
      this.logger.log(`[Host Action] Show answer for PIN ${pin} (Socket: ${client.id})`);

      const { stats, leaderboard } = await this.roomService.showAnswer(pin, hostId || 'host_id_default');
      const syncState = await this.roomService.getSyncState(pin);

      this.server.to(`room:${pin}`).emit('answer:reveal', { pin, stats, leaderboard });
      this.server.to(`room:${pin}`).emit('show_answer', { stats, leaderboard });
      this.server.to(`room:${pin}`).emit('session:sync', syncState);

      return { success: true, data: { stats, leaderboard, syncState } };
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to show answer' });
      return { success: false, message: error.message || 'Failed to show answer' };
    }
  }

  // HOST: Show Leaderboard
  @SubscribeMessage('host:showLeaderboard')
  @SubscribeMessage('host_show_leaderboard')
  async handleShowLeaderboard(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const dto = await this.validatePayload(HostActionDto, data);
      const { pin, hostId } = dto;
      const { leaderboard } = await this.roomService.showLeaderboard(pin, hostId || 'host_id_default');
      const syncState = await this.roomService.getSyncState(pin);

      this.server.to(`room:${pin}`).emit('leaderboard:update', { leaderboard });
      this.server.to(`room:${pin}`).emit('session:sync', syncState);

      return { success: true, data: { leaderboard, syncState } };
    } catch (error: any) {
      client.emit('error', { message: error.message || 'Failed to show leaderboard' });
      return { success: false, message: error.message || 'Failed to show leaderboard' };
    }
  }

  // HOST: Next Question
  @SubscribeMessage('host:next')
  @SubscribeMessage('host_next_question')
  async handleNextQuestion(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const dto = await this.validatePayload(HostActionDto, data);
      const { pin, hostId } = dto;
      const result = await this.roomService.nextQuestion(pin, hostId || 'host_id_default');

      if (result.finished) {
        this.server.to(`room:${pin}`).emit('quiz:finished', {
          leaderboard: result.leaderboard,
        });
        this.server.to(`room:${pin}`).emit('quiz_finished', {
          leaderboard: result.leaderboard,
        });
        this.metricsService.activeRoomsGauge.dec();
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

  // PLAYER: Answer Question
  @SubscribeMessage('player:answer')
  @SubscribeMessage('player_submit_answer')
  async handleSubmitAnswer(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<AckResult> {
    try {
      const dto = await this.validatePayload(SubmitAnswerDto, data);
      const { pin, playerId, questionId, optionId, textResponse } = dto;
      const sanitizedText = sanitizeInput(textResponse);
      this.logger.log(`[Answer Submission] Player ${playerId} question ${questionId} (Socket: ${client.id})`);

      const result = await this.roomService.submitResponse(
        pin,
        playerId,
        questionId,
        optionId,
        sanitizedText,
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

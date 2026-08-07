import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { v4 as uuidv4 } from 'uuid';

export type SessionState =
  | 'LOBBY'
  | 'QUESTION_ACTIVE'
  | 'QUESTION_LOCKED'
  | 'ANSWER_REVEAL'
  | 'LEADERBOARD'
  | 'QUIZ_FINISHED';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private roomTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  // Generate unique 6-digit PIN and initialize QuizSession
  async createRoom(quizId: string, hostId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    if (quiz.questions.length === 0) {
      throw new BadRequestException('Cannot host a quiz with zero questions');
    }

    let pin = '';
    let isUnique = false;
    while (!isUnique) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.prisma.quizSession.findUnique({ where: { pin } });
      if (!existing) isUnique = true;
    }

    const firstQuestion = quiz.questions[0];

    const session = await this.prisma.quizSession.create({
      data: {
        quizId,
        hostId,
        pin,
        status: 'LOBBY',
        currentQuestionIndex: 0,
        currentQuestionId: firstQuestion.id,
      },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: { options: true },
            },
          },
        },
      },
    });

    const roomState = {
      pin,
      sessionId: session.id,
      quizId: session.quizId,
      status: 'LOBBY' as SessionState,
      currentQuestionIndex: 0,
      currentQuestionId: firstQuestion.id,
      questionsCount: quiz.questions.length,
      questionStartTime: null,
      questionEndTime: null,
    };

    await this.cache.del(`room:${pin}`);
    await this.cache.set(`room:${pin}`, JSON.stringify(roomState), 14400);
    return session;
  }

  async getRoomState(pin: string) {
    const cached = await this.cache.get(`room:${pin}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const session = await this.prisma.quizSession.findUnique({
      where: { pin },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!session) return null;

    const questions = session.quiz?.questions || [];
    const currentIdx = Math.min(session.currentQuestionIndex, questions.length - 1);
    const currentQuestion = questions[currentIdx] || null;

    const roomState = {
      pin,
      sessionId: session.id,
      quizId: session.quizId,
      status: session.status as SessionState,
      currentQuestionIndex: currentIdx,
      currentQuestionId: currentQuestion ? currentQuestion.id : null,
      questionsCount: questions.length,
      questionStartTime: session.questionStartTime ? session.questionStartTime.toISOString() : null,
      questionEndTime: session.questionEndTime ? session.questionEndTime.toISOString() : null,
    };

    await this.cache.set(`room:${pin}`, JSON.stringify(roomState), 14400);
    return roomState;
  }

  async setRoomState(pin: string, state: any) {
    await this.cache.set(`room:${pin}`, JSON.stringify(state), 14400);
  }

  // Join Flow: Allowed only in LOBBY for new players. Reconnecting players handled automatically.
  async joinPlayer(pin: string, name: string, socketId: string) {
    const room = await this.getRoomState(pin);
    if (!room) {
      throw new NotFoundException('Quiz PIN code is invalid');
    }

    if (room.status === 'QUIZ_FINISHED') {
      throw new BadRequestException('Quiz session has finished');
    }

    let player = await this.prisma.player.findUnique({
      where: { sessionId_name: { sessionId: room.sessionId, name } },
    });

    if (player) {
      // Allow seamless reconnect even if quiz started
      const reconnectToken = player.reconnectToken || uuidv4();
      player = await this.prisma.player.update({
        where: { id: player.id },
        data: {
          socketId,
          isConnected: 'true',
          lastSeen: new Date(),
          reconnectToken,
          connectionVersion: { increment: 1 },
        },
      });
      this.logger.log(`Existing Player ${name} rejoined/reconnected to room ${pin}`);
      return player;
    }

    // New player registration allowed ONLY during LOBBY state
    if (room.status !== 'LOBBY') {
      throw new BadRequestException('Quiz has already started. New participant registrations are closed.');
    }

    const reconnectToken = uuidv4();
    player = await this.prisma.player.create({
      data: {
        sessionId: room.sessionId,
        name,
        socketId,
        isConnected: 'true',
        reconnectToken,
        lastSeen: new Date(),
      },
    });

    this.logger.log(`New Player ${name} registered in room ${pin}`);
    return player;
  }

  // Dedicated Kahoot-style Player Reconnect Flow
  async reconnectPlayer(pin: string, playerId: string, reconnectToken: string, socketId: string) {
    const room = await this.getRoomState(pin);
    if (!room) {
      throw new NotFoundException('Quiz PIN code is invalid');
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player || player.sessionId !== room.sessionId) {
      throw new NotFoundException('Player does not belong to this quiz session');
    }

    if (player.reconnectToken !== reconnectToken) {
      throw new BadRequestException('Invalid reconnect token');
    }

    // Update connection status
    const updatedPlayer = await this.prisma.player.update({
      where: { id: player.id },
      data: {
        socketId,
        isConnected: 'true',
        lastSeen: new Date(),
        connectionVersion: { increment: 1 },
      },
    });

    this.logger.log(`Player ${player.name} (${player.id}) reconnected successfully to pin ${pin}`);

    // Skip leaderboard query during reconnect to avoid DB pool exhaustion
    const syncState = await this.getSyncState(pin, player.id, true);
    return {
      player: updatedPlayer,
      syncState,
    };
  }

  async handlePlayerDisconnect(socketId: string) {
    try {
      const player = await this.prisma.player.findFirst({
        where: { socketId },
        select: { id: true, name: true, session: { select: { pin: true } } },
      });

      if (player && player.session) {
        await this.prisma.player.update({
          where: { id: player.id },
          data: { isConnected: 'false', lastSeen: new Date() },
        });
        this.logger.log(`Player ${player.name} marked disconnected from pin ${player.session.pin}`);
        return { pin: player.session.pin, player };
      }
    } catch (err: any) {
      this.logger.warn(`[Disconnect Handler Pool Warning] Socket ${socketId}: ${err.message}`);
    }
    return null;
  }

  async getPlayers(pin: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { pin },
      select: { id: true },
    });
    if (!session) return [];

    const players = await this.prisma.player.findMany({
      where: { sessionId: session.id },
      orderBy: { score: 'desc' },
    });

    const uniqueMap = new Map<string, typeof players[0]>();
    for (const player of players) {
      const normalized = player.name.trim().toLowerCase();
      if (!uniqueMap.has(normalized)) {
        uniqueMap.set(normalized, player);
      }
    }

    return Array.from(uniqueMap.values());
  }

  // Host Action: Start Quiz
  async startQuiz(pin: string, hostId?: string) {
    this.logger.log(`[Host Action] Start Quiz requested for PIN ${pin}`);

    const session = await this.prisma.quizSession.findUnique({
      where: { pin },
      include: { quiz: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } } },
    });

    if (!session) {
      this.logger.error(`[Start Quiz Failed] Room PIN ${pin} not found`);
      throw new NotFoundException('Quiz room session not found');
    }

    if (hostId && hostId !== 'host_id_default' && session.hostId !== hostId) {
      this.logger.warn(`[Start Quiz Rejected] Forbidden hostId ${hostId} for session host ${session.hostId}`);
      throw new ForbiddenException('Only the host can start this quiz session');
    }

    if (!session.quiz?.questions || session.quiz.questions.length === 0) {
      this.logger.error(`[Start Quiz Failed] Quiz ${session.quizId} has 0 questions`);
      throw new BadRequestException('Cannot host a quiz with zero questions');
    }

    const firstQuestion = session.quiz.questions[0];
    const now = new Date();
    const endTime = new Date(now.getTime() + firstQuestion.timeLimit * 1000);

    await this.prisma.quizSession.update({
      where: { id: session.id },
      data: {
        status: 'QUESTION_ACTIVE',
        currentQuestionIndex: 0,
        currentQuestionId: firstQuestion.id,
        questionStartTime: now,
        questionEndTime: endTime,
      },
    });

    this.logger.log(`[Session Updated] PIN ${pin} set to QUESTION_ACTIVE with question ${firstQuestion.id}`);

    const roomState = {
      pin,
      sessionId: session.id,
      quizId: session.quizId,
      status: 'QUESTION_ACTIVE' as SessionState,
      currentQuestionIndex: 0,
      currentQuestionId: firstQuestion.id,
      questionStartTime: now.toISOString(),
      questionEndTime: endTime.toISOString(),
    };
    await this.setRoomState(pin, roomState);

    return { session, question: firstQuestion, remainingSeconds: firstQuestion.timeLimit };
  }

  // Host Action: Next Question
  async nextQuestion(pin: string, hostId: string) {
    this.clearTimer(pin);

    const session = await this.prisma.quizSession.findUnique({
      where: { pin },
      include: { quiz: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } } },
    });

    if (!session || (hostId && hostId !== 'host_id_default' && session.hostId !== hostId)) {
      throw new ForbiddenException('Only the host can advance questions');
    }

    const nextIndex = session.currentQuestionIndex + 1;
    const questions = session.quiz.questions;

    if (nextIndex >= questions.length) {
      // Finish Quiz
      await this.prisma.quizSession.update({
        where: { id: session.id },
        data: {
          status: 'QUIZ_FINISHED',
          questionStartTime: null,
          questionEndTime: null,
        },
      });

      const roomState = {
        ...session,
        status: 'QUIZ_FINISHED' as SessionState,
        currentQuestionIndex: nextIndex,
        questionStartTime: null,
        questionEndTime: null,
      };
      await this.setRoomState(pin, roomState);

      const leaderboard = await this.getPlayers(pin);
      return { finished: true, leaderboard };
    }

    const nextQuestion = questions[nextIndex];
    const now = new Date();
    const endTime = new Date(now.getTime() + nextQuestion.timeLimit * 1000);

    await this.prisma.quizSession.update({
      where: { id: session.id },
      data: {
        status: 'QUESTION_ACTIVE',
        currentQuestionIndex: nextIndex,
        currentQuestionId: nextQuestion.id,
        questionStartTime: now,
        questionEndTime: endTime,
      },
    });

    const roomState = {
      pin,
      sessionId: session.id,
      quizId: session.quizId,
      status: 'QUESTION_ACTIVE' as SessionState,
      currentQuestionIndex: nextIndex,
      currentQuestionId: nextQuestion.id,
      questionsCount: questions.length,
      questionStartTime: now.toISOString(),
      questionEndTime: endTime.toISOString(),
    };
    await this.setRoomState(pin, roomState);

    return {
      finished: false,
      question: nextQuestion,
      questionIndex: nextIndex,
      totalQuestions: questions.length,
      remainingSeconds: nextQuestion.timeLimit,
    };
  }

  // Host Action: Skip Question (Immediately halts timer, locks answers, and reveals answer / next state)
  async skipQuestion(pin: string, hostId: string) {
    this.clearTimer(pin);

    const room = await this.getRoomState(pin);
    if (!room) throw new NotFoundException('Room not found');

    const now = new Date();
    await this.prisma.quizSession.update({
      where: { pin },
      data: {
        status: 'QUESTION_LOCKED',
        questionEndTime: now,
      },
    });

    const updatedState = {
      ...room,
      status: 'QUESTION_LOCKED' as SessionState,
      questionEndTime: now.toISOString(),
    };
    await this.setRoomState(pin, updatedState);

    const stats = await this.getQuestionStats(pin, room.currentQuestionId);
    return { pin, questionId: room.currentQuestionId, stats };
  }

  // Host Action: Show Answer (Stops timer, calculates scores, reveals correct options)
  async showAnswer(pin: string, hostId: string) {
    this.clearTimer(pin);

    const room = await this.getRoomState(pin);
    if (!room) throw new NotFoundException('Room not found');

    const now = new Date();
    await this.prisma.quizSession.update({
      where: { pin },
      data: {
        status: 'ANSWER_REVEAL',
        questionEndTime: now,
      },
    });

    const updatedState = {
      ...room,
      status: 'ANSWER_REVEAL' as SessionState,
      questionEndTime: now.toISOString(),
    };
    await this.setRoomState(pin, updatedState);

    const stats = await this.getQuestionStats(pin, room.currentQuestionId);
    const leaderboard = await this.getPlayers(pin);

    return { pin, questionId: room.currentQuestionId, stats, leaderboard };
  }

  // Host Action: Show Leaderboard
  async showLeaderboard(pin: string, hostId: string) {
    const room = await this.getRoomState(pin);
    if (!room) throw new NotFoundException('Room not found');

    await this.prisma.quizSession.update({
      where: { pin },
      data: { status: 'LEADERBOARD' },
    });

    const updatedState = {
      ...room,
      status: 'LEADERBOARD' as SessionState,
    };
    await this.setRoomState(pin, updatedState);

    const leaderboard = await this.getPlayers(pin);
    return { pin, leaderboard };
  }

  clearTimer(pin: string) {
    const timer = this.roomTimers.get(pin);
    if (timer) {
      clearInterval(timer);
      this.roomTimers.delete(pin);
    }
  }

  // Answer scoring algorithm (With atomic duplicate answer prevention)
  async submitResponse(pin: string, playerId: string, questionId: string, optionId: string, textResponse?: string) {
    const room = await this.getRoomState(pin);
    if (!room || (room.status !== 'QUESTION_ACTIVE' && room.status !== 'PLAYING')) {
      throw new BadRequestException('Quiz is not currently accepting answers');
    }

    // Check if player submitted before question end time
    if (room.questionEndTime) {
      const endTime = new Date(room.questionEndTime).getTime();
      if (Date.now() > endTime + 2000) { // 2s grace period for network jitter
        throw new BadRequestException('Time limit expired for this question');
      }
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) throw new NotFoundException('Player not found in this room');

    // Prevent duplicate responses
    const existing = await this.prisma.response.findUnique({
      where: { playerId_questionId: { playerId: player.id, questionId } },
    });
    if (existing) {
      return { duplicate: true };
    }

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true, quiz: true },
    });

    if (!question) throw new NotFoundException('Question not found');

    const totalTime = question.timeLimit * 1000;
    let responseTimeMs = 1000;
    if (room.questionStartTime) {
      const startTime = new Date(room.questionStartTime).getTime();
      responseTimeMs = Math.max(100, Date.now() - startTime);
    }

    let isCorrect = 'false';
    if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
      const selectedOption = question.options.find((o) => o.id === optionId);
      if (selectedOption && selectedOption.isCorrect === 'true') {
        isCorrect = 'true';
      }
    } else if (question.type === 'OPEN_TEXT') {
      const correctOption = question.options.find((o) => o.isCorrect === 'true');
      if (
        correctOption &&
        textResponse &&
        textResponse.trim().toLowerCase() === correctOption.text.trim().toLowerCase()
      ) {
        isCorrect = 'true';
      }
    } else {
      isCorrect = 'true';
    }

    let pointsEarned = 0;
    let newStreak = player.streak;

    if (isCorrect === 'true') {
      const basePoints = question.points;
      const speedFactor = 1 - (responseTimeMs / totalTime) * 0.5;
      const pointsWithSpeed = Math.round(basePoints * Math.max(0.5, speedFactor));

      newStreak += 1;
      const streakBonus = Math.min(5, newStreak) * 10;
      const multiplier = parseFloat(question.quiz.pointsMultiplier as any) || 1.0;
      pointsEarned = Math.round((pointsWithSpeed + streakBonus) * multiplier);
    } else {
      newStreak = 0;
      if (question.quiz.negativeMarking === 'true') {
        pointsEarned = -Math.round(question.points * 0.25);
      }
    }

    let updatedPlayer;
    try {
      await this.prisma.response.create({
        data: {
          playerId: player.id,
          questionId,
          optionId: optionId || null,
          textResponse: textResponse || null,
          isCorrect,
          pointsEarned,
          responseTimeMs,
        },
      });

      updatedPlayer = await this.prisma.player.update({
        where: { id: player.id },
        data: {
          score: { increment: pointsEarned },
          streak: newStreak,
          lastSeen: new Date(),
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return { duplicate: true };
      }
      throw err;
    }

    return {
      isCorrect: isCorrect === 'true',
      pointsEarned,
      newScore: updatedPlayer.score,
      newStreak,
    };
  }

  // Universal Sync Payload Creator for Reconnecting & Refreshing Clients
  // skipLeaderboard: set true during reconnect to avoid expensive getPlayers() query
  async getSyncState(pin: string, playerId?: string, skipLeaderboard = false) {
    const room = await this.getRoomState(pin);
    if (!room) return null;

    let questions: any[] = [];
    const cachedQuestions = await this.cache.get(`quiz:questions:${room.quizId}`);
    if (cachedQuestions) {
      questions = JSON.parse(cachedQuestions);
    } else {
      const qList = await this.prisma.question.findMany({
        where: { quizId: room.quizId },
        orderBy: { order: 'asc' },
        include: { options: true },
      });
      questions = qList;
      await this.cache.set(`quiz:questions:${room.quizId}`, JSON.stringify(qList), 3600);
    }

    const currentIdx = Math.min(room.currentQuestionIndex, Math.max(0, questions.length - 1));
    const currentQuestion = questions[currentIdx] || null;

    let remainingSeconds = 0;
    if (room.questionEndTime && room.status === 'QUESTION_ACTIVE') {
      const endMs = new Date(room.questionEndTime).getTime();
      remainingSeconds = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
    }

    let playerState = null;
    let existingResponse = null;

    if (playerId) {
      const player = await this.prisma.player.findUnique({
        where: { id: playerId },
        select: { id: true, name: true, score: true, streak: true, reconnectToken: true },
      });
      if (player) {
        playerState = player;
        if (currentQuestion) {
          existingResponse = await this.prisma.response.findFirst({
            where: { playerId: player.id, questionId: currentQuestion.id },
            select: { optionId: true, isCorrect: true, pointsEarned: true },
          });
        }
      }
    }

    // Skip leaderboard during reconnect to avoid N×getPlayers pool exhaustion
    let leaderboard: any[] = [];
    if (!skipLeaderboard) {
      const players = await this.getPlayers(pin);
      leaderboard = players.map((p) => ({ id: p.id, name: p.name, score: p.score, streak: p.streak }));
    }

    // Sanitize options for active question to prevent client cheating
    let sanitizedQuestion = null;
    if (currentQuestion) {
      sanitizedQuestion = {
        id: currentQuestion.id,
        text: currentQuestion.text,
        type: currentQuestion.type,
        order: currentQuestion.order,
        points: currentQuestion.points,
        timeLimit: currentQuestion.timeLimit,
        imageUrl: currentQuestion.imageUrl,
        options: currentQuestion.options.map((o) => ({
          id: o.id,
          text: o.text,
          // Hide isCorrect status during active question phase
          ...(room.status === 'ANSWER_REVEAL' || room.status === 'LEADERBOARD' || room.status === 'QUIZ_FINISHED'
            ? { isCorrect: o.isCorrect === 'true' }
            : {}),
        })),
      };
    }

    return {
      pin,
      status: room.status,
      currentQuestionIndex: currentIdx,
      totalQuestions: questions.length,
      remainingSeconds,
      currentQuestion: sanitizedQuestion,
      player: playerState,
      hasAnswered: !!existingResponse,
      selectedOptionId: existingResponse?.optionId || null,
      leaderboard,
    };
  }

  async getQuestionStats(pin: string, questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!question) return null;

    const responses = await this.prisma.response.findMany({
      where: { questionId },
    });

    const optionCounts = question.options.map((o) => {
      const count = responses.filter((r) => r.optionId === o.id).length;
      return {
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect === 'true',
        count,
      };
    });

    const totalResponses = responses.length;
    const correctCount = responses.filter((r) => r.isCorrect === 'true').length;

    return {
      questionText: question.text,
      questionExplanation: question.explanation,
      options: optionCounts,
      totalResponses,
      correctCount,
      incorrectCount: totalResponses - correctCount,
    };
  }

  /**
   * Reset a load-test room back to LOBBY state.
   * Clears: DB session status, all players and responses, AND in-memory/Redis cache.
   */
  async resetLoadTestRoom(pin: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { pin },
      select: { id: true, quizId: true, quiz: { select: { questions: { select: { id: true } } } } },
    });

    if (!session) {
      this.logger.warn(`[Reset] No session found for PIN ${pin}`);
      return;
    }

    // Delete all responses for this session's questions
    const questionIds = session.quiz?.questions?.map((q) => q.id) || [];
    if (questionIds.length > 0) {
      await this.prisma.response.deleteMany({
        where: { questionId: { in: questionIds } },
      });
      this.logger.log(`[Reset] Deleted responses for ${questionIds.length} questions`);
    }

    // Delete all players for this session
    await this.prisma.player.deleteMany({
      where: { sessionId: session.id },
    });
    this.logger.log(`[Reset] Deleted all players for session ${session.id}`);

    // Reset session to LOBBY
    const firstQuestionId = questionIds[0] || null;
    await this.prisma.quizSession.update({
      where: { pin },
      data: {
        status: 'LOBBY',
        currentQuestionIndex: 0,
        currentQuestionId: firstQuestionId,
        questionStartTime: null,
        questionEndTime: null,
      },
    });

    // Clear in-memory/Redis cache for room state
    await this.cache.del(`room:${pin}`);
    await this.cache.del(`quiz:questions:${session.quizId}`);

    // Set fresh LOBBY cache
    const roomState = {
      pin,
      sessionId: session.id,
      quizId: session.quizId,
      status: 'LOBBY' as SessionState,
      currentQuestionIndex: 0,
      currentQuestionId: firstQuestionId,
      questionsCount: questionIds.length,
      questionStartTime: null,
      questionEndTime: null,
    };
    await this.cache.set(`room:${pin}`, JSON.stringify(roomState), 14400);

    this.logger.log(`[Reset] Room ${pin} fully reset to LOBBY (DB + cache cleared)`);
  }
}

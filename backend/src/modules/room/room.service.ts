import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private roomTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  // Generate unique PIN for room
  async createRoom(quizId: string, hostId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { include: { options: true } } },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    if (quiz.questions.length === 0) {
      throw new BadRequestException('Cannot start a quiz with zero questions');
    }

    // Generate random 6-digit numeric PIN
    let pin = '';
    let isUnique = false;
    while (!isUnique) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.prisma.quizSession.findUnique({ where: { pin } });
      if (!existing) isUnique = true;
    }

    // Create session in Database
    const session = await this.prisma.quizSession.create({
      data: {
        quizId,
        hostId,
        pin,
        status: 'LOBBY',
        currentQuestionId: quiz.questions[0].id,
      },
      include: {
        quiz: {
          include: {
            questions: {
              include: { options: true },
            },
          },
        },
      },
    });

    // Save initial state to Cache (Redis/In-Memory) for fast real-time access
    const roomState = {
      pin,
      sessionId: session.id,
      quizId: session.quizId,
      status: 'LOBBY',
      currentQuestionIdx: 0,
      currentQuestionId: quiz.questions[0].id,
      questionsCount: quiz.questions.length,
      timeLeft: quiz.questions[0].timeLimit,
      isActive: true,
    };

    await this.cache.set(`room:${pin}`, JSON.stringify(roomState), 14400); // 4 hours TTL
    return session;
  }

  async getRoomState(pin: string) {
    const cached = await this.cache.get(`room:${pin}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
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

    const currentQuestionIdx = session.quiz.questions.findIndex(q => q.id === session.currentQuestionId);
    const roomState = {
      pin,
      sessionId: session.id,
      quizId: session.quizId,
      status: session.status,
      currentQuestionIdx: currentQuestionIdx >= 0 ? currentQuestionIdx : 0,
      currentQuestionId: session.currentQuestionId,
      questionsCount: session.quiz.questions.length,
      timeLeft: session.quiz.questions[currentQuestionIdx >= 0 ? currentQuestionIdx : 0]?.timeLimit || 20,
      isActive: true,
    };

    await this.cache.set(`room:${pin}`, JSON.stringify(roomState), 14400);
    return roomState;
  }

  async setRoomState(pin: string, state: any) {
    await this.cache.set(`room:${pin}`, JSON.stringify(state), 14400);
  }

  async joinPlayer(pin: string, name: string, socketId: string) {
    const room = await this.getRoomState(pin);
    if (!room) {
      throw new NotFoundException('Quiz room code is invalid');
    }
    if (room.status !== 'LOBBY') {
      throw new BadRequestException('Quiz has already started or finished');
    }

    // Check if player exists or needs reconnect
    let player = await this.prisma.player.findUnique({
      where: { sessionId_name: { sessionId: room.sessionId, name } },
    });

    if (player) {
      // Reconnection or name conflict
      if (player.isConnected === 'false') {
        player = await this.prisma.player.update({
          where: { id: player.id },
          data: { isConnected: 'true', socketId },
        });
        this.logger.log(`Player ${name} reconnected to room ${pin}`);
      } else {
        throw new BadRequestException('Nickname is already taken in this room');
      }
    } else {
      // Create new Player in database
      player = await this.prisma.player.create({
        data: {
          sessionId: room.sessionId,
          name,
          socketId,
          isConnected: 'true',
        },
      });
      this.logger.log(`Player ${name} joined room ${pin}`);
    }

    return player;
  }

  async handlePlayerDisconnect(socketId: string) {
    const player = await this.prisma.player.findFirst({
      where: { socketId },
      include: { session: true },
    });

    if (player) {
      // Set to false for graceful reconnect tolerance
      await this.prisma.player.update({
        where: { id: player.id },
        data: { isConnected: 'false' },
      });
      this.logger.log(`Player ${player.name} marked disconnected from room ${player.session.pin}`);
      return { pin: player.session.pin, player };
    }
    return null;
  }

  async getPlayers(pin: string) {
    const room = await this.getRoomState(pin);
    if (!room) return [];

    return this.prisma.player.findMany({
      where: { sessionId: room.sessionId },
      orderBy: { score: 'desc' },
    });
  }

  // Question Timer Orchestration
  async startQuestionTimer(pin: string, onTick: (timeLeft: number) => void, onTimeout: () => void) {
    // Clear existing timer if any
    this.clearTimer(pin);

    const room = await this.getRoomState(pin);
    if (!room) return;

    let timeLeft = room.timeLeft;
    onTick(timeLeft);

    const interval = setInterval(async () => {
      timeLeft--;
      room.timeLeft = timeLeft;
      await this.setRoomState(pin, room);

      onTick(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(interval);
        this.roomTimers.delete(pin);
        onTimeout();
      }
    }, 1000);

    this.roomTimers.set(pin, interval);
  }

  clearTimer(pin: string) {
    const timer = this.roomTimers.get(pin);
    if (timer) {
      clearInterval(timer);
      this.roomTimers.delete(pin);
    }
  }

  // Answer scoring algorithm
  async submitResponse(pin: string, name: string, questionId: string, optionId: string, textResponse?: string) {
    const room = await this.getRoomState(pin);
    if (!room || room.status !== 'PLAYING') {
      throw new BadRequestException('Quiz is not active or accepting answers');
    }

    const player = await this.prisma.player.findUnique({
      where: { sessionId_name: { sessionId: room.sessionId, name } },
    });

    if (!player) throw new NotFoundException('Player not registered in this room');

    // Prevent duplicate responses for same question
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

    // Calculate response speed & correct status
    const totalTime = question.timeLimit * 1000;
    // Simulate high precision time based on timeLeft
    const timeLeftMs = room.timeLeft * 1000;
    const responseTimeMs = Math.max(100, totalTime - timeLeftMs);

    let isCorrect = 'false';
    if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
      const selectedOption = question.options.find(o => o.id === optionId);
      if (selectedOption && selectedOption.isCorrect === 'true') {
        isCorrect = 'true';
      }
    } else if (question.type === 'OPEN_TEXT') {
      const correctOption = question.options.find(o => o.isCorrect === 'true');
      if (correctOption && textResponse && textResponse.trim().toLowerCase() === correctOption.text.trim().toLowerCase()) {
        isCorrect = 'true';
      }
    } else {
      // POLL is always correct / neutral score
      isCorrect = 'true';
    }

    // Points calculation: Base Points * (1 - (responseTimeMs / totalTime) * 0.5)
    let pointsEarned = 0;
    let newStreak = player.streak;

    if (isCorrect === 'true') {
      const basePoints = question.points;
      const speedFactor = 1 - (responseTimeMs / totalTime) * 0.5; // Up to 50% decay
      const pointsWithSpeed = Math.round(basePoints * Math.max(0.5, speedFactor));
      
      // Streak calculation (cap at 5 streak bonus, +10 points per streak item)
      newStreak += 1;
      const streakBonus = Math.min(5, newStreak) * 10;
      
      // Multiply with Quiz Level Points Multiplier
      const multiplier = parseFloat(question.quiz.pointsMultiplier as any) || 1.0;
      pointsEarned = Math.round((pointsWithSpeed + streakBonus) * multiplier);
    } else {
      // Negative marking check
      newStreak = 0;
      if (question.quiz.negativeMarking === 'true') {
        pointsEarned = -Math.round(question.points * 0.25); // -25% penalty
      }
    }

    // Write Response to database
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

    // Update Player accumulators
    const updatedPlayer = await this.prisma.player.update({
      where: { id: player.id },
      data: {
        score: { increment: pointsEarned },
        streak: newStreak,
      },
    });

    return {
      isCorrect: isCorrect === 'true',
      pointsEarned,
      newScore: updatedPlayer.score,
      newStreak,
    };
  }

  // Answer reveal aggregation
  async getQuestionStats(pin: string, questionId: string) {
    const room = await this.getRoomState(pin);
    if (!room) return null;

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!question) return null;

    const responses = await this.prisma.response.findMany({
      where: { questionId },
    });

    // Aggregate options counts
    const optionCounts = question.options.map(o => {
      const count = responses.filter(r => r.optionId === o.id).length;
      return {
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect === 'true',
        count,
      };
    });

    const totalResponses = responses.length;
    const correctCount = responses.filter(r => r.isCorrect === 'true').length;

    return {
      questionText: question.text,
      questionExplanation: question.explanation,
      options: optionCounts,
      totalResponses,
      correctCount,
      incorrectCount: totalResponses - correctCount,
    };
  }
}

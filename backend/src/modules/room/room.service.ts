import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { MetricsService } from "../metrics/metrics.service";
import { v4 as uuidv4 } from "uuid";
import { Server } from "socket.io";

export type SessionState =
  | "LOBBY"
  | "QUESTION_ACTIVE"
  | "QUESTION_LOCKED"
  | "ANSWER_REVEAL"
  | "LEADERBOARD"
  | "QUIZ_FINISHED"
  | "PAUSED"
  | "PLAYING";

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private roomTimers = new Map<string, NodeJS.Timeout>();
  private server: Server | null = null;

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private metricsService: MetricsService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  // Generate unique 6-digit numeric PIN
  private async generateUniquePin(): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts++) {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.prisma.quizSession.findUnique({
        where: { pin },
      });
      if (!existing) return pin;
    }
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async createRoom(quizId: string, hostId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }

    const pin = await this.generateUniquePin();

    const session = await this.prisma.quizSession.create({
      data: {
        pin,
        quizId,
        hostId,
        status: "LOBBY",
        currentQuestionIndex: 0,
      },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    // Populate Redis Cache
    const roomState = {
      pin,
      sessionId: session.id,
      quizId: session.quizId,
      quizTitle: quiz.title,
      status: "LOBBY" as SessionState,
      currentQuestionIndex: 0,
      currentQuestionId: quiz.questions[0]?.id || null,
      questionsCount: quiz.questions.length,
      questionStartTime: null,
      questionEndTime: null,
    };
    await this.cache.set(`room:${pin}`, JSON.stringify(roomState), 14400); // 4 hrs TTL

    this.logger.log(
      `Room created successfully: PIN ${pin} Session ${session.id}`,
    );
    return session;
  }

  async getRoomState(pin: string) {
    if (!pin) return null;
    const cleanPin = String(pin).trim();
    const cached = await this.cache.get(`room:${cleanPin}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fallback to DB query
      }
    }

    const session = await this.prisma.quizSession.findUnique({
      where: { pin: cleanPin },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!session) return null;

    const questions = session.quiz?.questions || [];
    const currentIdx = Math.min(
      session.currentQuestionIndex,
      questions.length - 1,
    );
    const currentQuestion = questions[currentIdx] || null;

    const roomState = {
      pin: cleanPin,
      sessionId: session.id,
      quizId: session.quizId,
      quizTitle: session.quiz?.title || "Quiz Session",
      status: session.status as SessionState,
      currentQuestionIndex: currentIdx,
      currentQuestionId: currentQuestion ? currentQuestion.id : null,
      questionsCount: questions.length,
      questionStartTime: session.questionStartTime
        ? session.questionStartTime.toISOString()
        : null,
      questionEndTime: session.questionEndTime
        ? session.questionEndTime.toISOString()
        : null,
    };

    await this.cache.set(`room:${cleanPin}`, JSON.stringify(roomState), 14400);
    return roomState;
  }

  async setRoomState(pin: string, state: any) {
    const cleanPin = String(pin).trim();
    await this.cache.set(`room:${cleanPin}`, JSON.stringify(state), 14400);
  }

  // Reset load-test room to LOBBY
  async resetLoadTestRoom(pin: string) {
    const cleanPin = String(pin).trim();
    this.clearTimer(cleanPin);

    const session = await this.prisma.quizSession.findUnique({
      where: { pin: cleanPin },
    });
    if (!session) return;

    await this.prisma.player.deleteMany({
      where: { sessionId: session.id },
    });

    await this.prisma.quizSession.update({
      where: { id: session.id },
      data: {
        status: "LOBBY",
        currentQuestionIndex: 0,
        currentQuestionId: null,
        questionStartTime: null,
        questionEndTime: null,
      },
    });

    await this.cache.del(`room:${cleanPin}`);
    await this.getRoomState(cleanPin);
  }

  // Join Flow: Allowed for new players in LOBBY, or seamless rejoin for existing players anytime.
  async joinPlayer(rawPin: string, rawName: string, socketId: string) {
    const pin = rawPin ? String(rawPin).trim() : "";
    const name = rawName ? String(rawName).trim() : "";

    if (!pin || pin.length !== 6) {
      throw new BadRequestException("PIN must consist of 6 numeric digits");
    }
    if (!name) {
      throw new BadRequestException("Please enter a valid nickname");
    }

    const room = await this.getRoomState(pin);
    if (!room) {
      throw new NotFoundException("Quiz PIN code is invalid");
    }

    if (room.status === "QUIZ_FINISHED") {
      throw new BadRequestException("Quiz session has finished");
    }

    // Case-insensitive search for existing player in room session
    let player = await this.prisma.player.findFirst({
      where: {
        sessionId: room.sessionId,
        name: { equals: name, mode: "insensitive" },
      },
    });

    if (player) {
      // Reconnect/rejoin existing player seamlessly
      const reconnectToken = player.reconnectToken || uuidv4();
      player = await this.prisma.player.update({
        where: { id: player.id },
        data: {
          socketId,
          isConnected: "true",
          lastSeen: new Date(),
          reconnectToken,
          connectionVersion: { increment: 1 },
        },
      });
      this.logger.log(`Existing Player ${name} rejoined room ${pin}`);
      return player;
    }

    // New player registration allowed ONLY during LOBBY state
    if (room.status !== "LOBBY") {
      throw new BadRequestException(
        "Quiz has already started. New participant registrations are closed.",
      );
    }

    const reconnectToken = uuidv4();
    player = await this.prisma.player.create({
      data: {
        sessionId: room.sessionId,
        name,
        socketId,
        isConnected: "true",
        reconnectToken,
        lastSeen: new Date(),
      },
    });

    this.logger.log(`New Player ${name} registered in room ${pin}`);
    return player;
  }

  // Dedicated Kahoot-style Player Reconnect Flow
  async reconnectPlayer(
    pin: string,
    playerId: string,
    reconnectToken: string,
    socketId: string,
  ) {
    const cleanPin = String(pin).trim();
    const room = await this.getRoomState(cleanPin);
    if (!room) {
      throw new NotFoundException("Quiz PIN code is invalid");
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player || player.sessionId !== room.sessionId) {
      throw new NotFoundException(
        "Player does not belong to this quiz session",
      );
    }

    if (player.reconnectToken !== reconnectToken) {
      throw new BadRequestException("Invalid reconnect token");
    }

    const updatedPlayer = await this.prisma.player.update({
      where: { id: player.id },
      data: {
        socketId,
        isConnected: "true",
        lastSeen: new Date(),
        connectionVersion: { increment: 1 },
      },
    });

    this.logger.log(
      `Player ${player.name} (${player.id}) reconnected successfully to pin ${cleanPin}`,
    );

    const syncState = await this.getSyncState(cleanPin, player.id, true);
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
          data: { isConnected: "false", lastSeen: new Date() },
        });
        this.logger.log(
          `Player ${player.name} marked disconnected from pin ${player.session.pin}`,
        );
        return { pin: player.session.pin, player };
      }
    } catch (err: any) {
      this.logger.warn(
        `[Disconnect Handler Warning] Socket ${socketId}: ${err.message}`,
      );
    }
    return null;
  }

  async getPlayers(pin: string) {
    const cleanPin = String(pin).trim();
    const session = await this.prisma.quizSession.findUnique({
      where: { pin: cleanPin },
      select: { id: true },
    });
    if (!session) return [];

    const players = await this.prisma.player.findMany({
      where: { sessionId: session.id },
      orderBy: { score: "desc" },
    });

    const uniqueMap = new Map<string, (typeof players)[0]>();
    for (const player of players) {
      const normalized = player.name.trim().toLowerCase();
      if (!uniqueMap.has(normalized)) {
        uniqueMap.set(normalized, player);
      }
    }

    return Array.from(uniqueMap.values());
  }

  // Server-side automatic question timer
  startQuestionTimer(pin: string, durationSeconds: number) {
    this.clearTimer(pin);

    const timer = setTimeout(
      async () => {
        this.roomTimers.delete(pin);
        try {
          const room = await this.getRoomState(pin);
          if (
            room &&
            (room.status === "QUESTION_ACTIVE" || room.status === "PLAYING")
          ) {
            this.logger.log(
              `[Auto Timer Expired] PIN ${pin} revealing answer automatically...`,
            );
            const { stats, leaderboard } = await this.showAnswer(
              pin,
              "host_id_default",
            );
            const syncState = await this.getSyncState(pin);

            if (this.server) {
              this.server
                .to(`room:${pin}`)
                .emit("answer:reveal", { pin, stats, leaderboard });
              this.server
                .to(`room:${pin}`)
                .emit("show_answer", { stats, leaderboard });
              this.server.to(`room:${pin}`).emit("session:sync", syncState);
            }
          }
        } catch (err: any) {
          this.logger.error(
            `[Auto Timer Reveal Error] PIN ${pin}: ${err.message}`,
          );
        }
      },
      (durationSeconds + 1) * 1000,
    );

    this.roomTimers.set(pin, timer);
  }

  clearTimer(pin: string) {
    const cleanPin = String(pin).trim();
    const timer = this.roomTimers.get(cleanPin);
    if (timer) {
      clearTimeout(timer);
      this.roomTimers.delete(cleanPin);
    }
  }

  // Host Action: Start Quiz
  async startQuiz(pin: string, hostId?: string) {
    const cleanPin = String(pin).trim();
    this.logger.log(`[Host Action] Start Quiz requested for PIN ${cleanPin}`);

    const session = await this.prisma.quizSession.findUnique({
      where: { pin: cleanPin },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: { options: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Quiz room session not found");
    }

    if (hostId && hostId !== "host_id_default" && session.hostId !== hostId) {
      throw new ForbiddenException("Only the host can start this quiz session");
    }

    if (!session.quiz?.questions || session.quiz.questions.length === 0) {
      throw new BadRequestException("Cannot host a quiz with zero questions");
    }

    const firstQuestion = session.quiz.questions[0];
    const now = new Date();
    const endTime = new Date(now.getTime() + firstQuestion.timeLimit * 1000);

    await this.prisma.quizSession.update({
      where: { id: session.id },
      data: {
        status: "QUESTION_ACTIVE",
        currentQuestionIndex: 0,
        currentQuestionId: firstQuestion.id,
        questionStartTime: now,
        questionEndTime: endTime,
      },
    });

    const roomState = {
      pin: cleanPin,
      sessionId: session.id,
      quizId: session.quizId,
      quizTitle: session.quiz.title,
      status: "QUESTION_ACTIVE" as SessionState,
      currentQuestionIndex: 0,
      currentQuestionId: firstQuestion.id,
      questionsCount: session.quiz.questions.length,
      questionStartTime: now.toISOString(),
      questionEndTime: endTime.toISOString(),
    };
    await this.setRoomState(cleanPin, roomState);

    // Start auto reveal timer for question duration
    this.startQuestionTimer(cleanPin, firstQuestion.timeLimit);

    return {
      session,
      question: firstQuestion,
      remainingSeconds: firstQuestion.timeLimit,
      quizTitle: session.quiz.title,
    };
  }

  // Host Action: Next Question
  async nextQuestion(pin: string, hostId: string) {
    const cleanPin = String(pin).trim();
    this.clearTimer(cleanPin);

    const session = await this.prisma.quizSession.findUnique({
      where: { pin: cleanPin },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: { options: true },
            },
          },
        },
      },
    });

    if (
      !session ||
      (hostId && hostId !== "host_id_default" && session.hostId !== hostId)
    ) {
      throw new ForbiddenException("Only the host can advance questions");
    }

    const nextIndex = session.currentQuestionIndex + 1;
    const questions = session.quiz.questions;

    if (nextIndex >= questions.length) {
      // Finish Quiz
      await this.prisma.quizSession.update({
        where: { id: session.id },
        data: {
          status: "QUIZ_FINISHED",
          questionStartTime: null,
          questionEndTime: null,
        },
      });

      const roomState = {
        ...session,
        status: "QUIZ_FINISHED" as SessionState,
        currentQuestionIndex: nextIndex,
        questionStartTime: null,
        questionEndTime: null,
      };
      await this.setRoomState(cleanPin, roomState);

      const leaderboard = await this.getPlayers(cleanPin);
      return { finished: true, leaderboard };
    }

    const nextQuestion = questions[nextIndex];
    const now = new Date();
    const endTime = new Date(now.getTime() + nextQuestion.timeLimit * 1000);

    await this.prisma.quizSession.update({
      where: { id: session.id },
      data: {
        status: "QUESTION_ACTIVE",
        currentQuestionIndex: nextIndex,
        currentQuestionId: nextQuestion.id,
        questionStartTime: now,
        questionEndTime: endTime,
      },
    });

    const roomState = {
      pin: cleanPin,
      sessionId: session.id,
      quizId: session.quizId,
      quizTitle: session.quiz.title,
      status: "QUESTION_ACTIVE" as SessionState,
      currentQuestionIndex: nextIndex,
      currentQuestionId: nextQuestion.id,
      questionsCount: questions.length,
      questionStartTime: now.toISOString(),
      questionEndTime: endTime.toISOString(),
    };
    await this.setRoomState(cleanPin, roomState);

    // Start auto reveal timer for next question duration
    this.startQuestionTimer(cleanPin, nextQuestion.timeLimit);

    return {
      finished: false,
      question: nextQuestion,
      questionIndex: nextIndex,
      totalQuestions: questions.length,
      remainingSeconds: nextQuestion.timeLimit,
      quizTitle: session.quiz.title,
    };
  }

  // Host Action: Skip Question
  async skipQuestion(pin: string, hostId: string) {
    const cleanPin = String(pin).trim();
    this.clearTimer(cleanPin);

    const room = await this.getRoomState(cleanPin);
    if (!room) throw new NotFoundException("Room not found");

    const now = new Date();
    await this.prisma.quizSession.update({
      where: { pin: cleanPin },
      data: {
        status: "QUESTION_LOCKED",
        questionEndTime: now,
      },
    });

    const updatedState = {
      ...room,
      status: "QUESTION_LOCKED" as SessionState,
      questionEndTime: now.toISOString(),
    };
    await this.setRoomState(cleanPin, updatedState);

    const stats = await this.getQuestionStats(cleanPin, room.currentQuestionId);
    return { pin: cleanPin, questionId: room.currentQuestionId, stats };
  }

  // Host Action: Show Answer
  async showAnswer(pin: string, hostId: string) {
    const cleanPin = String(pin).trim();
    this.clearTimer(cleanPin);

    const room = await this.getRoomState(cleanPin);
    if (!room) throw new NotFoundException("Room not found");

    const now = new Date();
    await this.prisma.quizSession.update({
      where: { pin: cleanPin },
      data: {
        status: "ANSWER_REVEAL",
        questionEndTime: now,
      },
    });

    const updatedState = {
      ...room,
      status: "ANSWER_REVEAL" as SessionState,
      questionEndTime: now.toISOString(),
    };
    await this.setRoomState(cleanPin, updatedState);

    const stats = await this.getQuestionStats(cleanPin, room.currentQuestionId);
    const leaderboard = await this.getPlayers(cleanPin);

    return {
      pin: cleanPin,
      questionId: room.currentQuestionId,
      stats,
      leaderboard,
    };
  }

  // Host Action: Show Leaderboard
  async showLeaderboard(pin: string, hostId: string) {
    const cleanPin = String(pin).trim();
    const room = await this.getRoomState(cleanPin);
    if (!room) throw new NotFoundException("Room not found");

    await this.prisma.quizSession.update({
      where: { pin: cleanPin },
      data: { status: "LEADERBOARD" },
    });

    const updatedState = {
      ...room,
      status: "LEADERBOARD" as SessionState,
    };
    await this.setRoomState(cleanPin, updatedState);

    const leaderboard = await this.getPlayers(cleanPin);
    return { pin: cleanPin, leaderboard };
  }

  // Answer scoring algorithm
  async submitResponse(
    pin: string,
    playerId: string,
    questionId: string,
    optionId: string,
    textResponse?: string,
  ) {
    const cleanPin = String(pin).trim();
    const room = await this.getRoomState(cleanPin);
    if (
      !room ||
      (room.status !== "QUESTION_ACTIVE" && room.status !== "PLAYING")
    ) {
      throw new BadRequestException("Quiz is not currently accepting answers");
    }

    if (room.questionEndTime) {
      const endTime = new Date(room.questionEndTime).getTime();
      if (Date.now() > endTime + 2000) {
        throw new BadRequestException("Time limit expired for this question");
      }
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) throw new NotFoundException("Player not found in this room");

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

    if (!question) throw new NotFoundException("Question not found");

    let isCorrect = false;
    let selectedOptText = textResponse || "";

    if (optionId) {
      const selectedOpt = question.options.find((o) => o.id === optionId);
      if (selectedOpt) {
        selectedOptText = selectedOpt.text;
        isCorrect = selectedOpt.isCorrect === "true";
      }
    }

    let pointsEarned = 0;
    if (isCorrect) {
      const startTime = room.questionStartTime
        ? new Date(room.questionStartTime).getTime()
        : Date.now();
      const elapsedMs = Math.max(0, Date.now() - startTime);
      const totalTimeMs = question.timeLimit * 1000;
      const speedRatio = Math.max(0, (totalTimeMs - elapsedMs) / totalTimeMs);

      const basePoints = question.points || 100;
      const multiplier = question.quiz?.pointsMultiplier || 1.0;
      const streakMultiplier = 1 + Math.min(player.streak, 5) * 0.1;

      pointsEarned = Math.round(
        basePoints * (0.5 + 0.5 * speedRatio) * multiplier * streakMultiplier,
      );
    }

    const newScore = player.score + pointsEarned;
    const newStreak = isCorrect ? player.streak + 1 : 0;

    await this.prisma.$transaction([
      this.prisma.response.create({
        data: {
          playerId: player.id,
          questionId: question.id,
          optionId: optionId || null,
          textResponse: selectedOptText,
          isCorrect: isCorrect ? "true" : "false",
          pointsEarned,
          responseTimeMs: Math.max(
            0,
            Date.now() -
              (room.questionStartTime
                ? new Date(room.questionStartTime).getTime()
                : Date.now()),
          ),
        },
      }),
      this.prisma.player.update({
        where: { id: player.id },
        data: {
          score: newScore,
          streak: newStreak,
        },
      }),
    ]);

    return {
      duplicate: false,
      isCorrect,
      pointsEarned,
      newScore,
      newStreak,
    };
  }

  async getQuestionStats(pin: string, questionId: string) {
    const cleanPin = String(pin).trim();
    const session = await this.prisma.quizSession.findUnique({
      where: { pin: cleanPin },
      select: { id: true },
    });
    if (!session || !questionId) return null;

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!question) return null;

    const responses = await this.prisma.response.findMany({
      where: { player: { sessionId: session.id }, questionId },
    });

    const optionCounts = new Map<string, number>();
    question.options.forEach((o) => optionCounts.set(o.id, 0));

    let correctCount = 0;
    responses.forEach((r) => {
      if (r.optionId && optionCounts.has(r.optionId)) {
        optionCounts.set(r.optionId, (optionCounts.get(r.optionId) || 0) + 1);
      }
      if (r.isCorrect === "true") correctCount++;
    });

    return {
      questionId,
      totalResponses: responses.length,
      correctResponses: correctCount,
      accuracyRate:
        responses.length > 0
          ? Math.round((correctCount / responses.length) * 100)
          : 0,
      options: question.options.map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect === "true",
        count: optionCounts.get(o.id) || 0,
      })),
    };
  }

  async getSyncState(pin: string, playerId?: string, skipLeaderboard = false) {
    const cleanPin = String(pin).trim();
    const room = await this.getRoomState(cleanPin);
    if (!room) return null;

    const session = await this.prisma.quizSession.findUnique({
      where: { pin: cleanPin },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: { options: true },
            },
          },
        },
      },
    });

    if (!session) return null;

    const questions = session.quiz?.questions || [];
    const currentIdx = Math.min(
      session.currentQuestionIndex,
      questions.length - 1,
    );
    const currentQuestion = questions[currentIdx] || null;

    let remainingSeconds = 0;
    if (session.status === "QUESTION_ACTIVE" && session.questionEndTime) {
      const msLeft = session.questionEndTime.getTime() - Date.now();
      remainingSeconds = Math.max(0, Math.ceil(msLeft / 1000));
    }

    let hasAnswered = false;
    let selectedOptionId: string | null = null;
    let playerObj: any = null;

    if (playerId) {
      playerObj = await this.prisma.player.findUnique({
        where: { id: playerId },
      });
      if (currentQuestion) {
        const resp = await this.prisma.response.findUnique({
          where: {
            playerId_questionId: { playerId, questionId: currentQuestion.id },
          },
        });
        if (resp) {
          hasAnswered = true;
          selectedOptionId = resp.optionId;
        }
      }
    }

    const leaderboard = skipLeaderboard ? [] : await this.getPlayers(cleanPin);

    return {
      pin: cleanPin,
      status: session.status,
      currentQuestionIndex: currentIdx,
      totalQuestions: questions.length,
      currentQuestion: currentQuestion
        ? {
            id: currentQuestion.id,
            text: currentQuestion.text,
            type: currentQuestion.type,
            points: currentQuestion.points,
            timeLimit: currentQuestion.timeLimit,
            imageUrl: currentQuestion.imageUrl,
            explanation:
              session.status === "ANSWER_REVEAL" ||
              session.status === "QUESTION_LOCKED"
                ? currentQuestion.explanation
                : undefined,
            options: (currentQuestion.options || []).map((o) => ({
              id: o.id,
              text: o.text,
              isCorrect:
                session.status === "ANSWER_REVEAL" ||
                session.status === "QUESTION_LOCKED"
                  ? o.isCorrect === "true"
                  : undefined,
            })),
          }
        : null,
      remainingSeconds,
      hasAnswered,
      selectedOptionId,
      player: playerObj
        ? {
            id: playerObj.id,
            name: playerObj.name,
            score: playerObj.score,
            streak: playerObj.streak,
          }
        : null,
      leaderboard,
    };
  }
}

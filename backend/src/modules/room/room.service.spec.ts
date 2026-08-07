import { Test, TestingModule } from "@nestjs/testing";
import { RoomService } from "./room.service";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { MetricsService } from "../metrics/metrics.service";

describe("RoomService", () => {
  let service: RoomService;

  const mockPrismaService = {
    quiz: {
      findUnique: jest.fn(),
    },
    quizSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    player: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    response: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockMetricsService = {
    activeSocketsGauge: { inc: jest.fn(), dec: jest.fn() },
    activeRoomsGauge: { inc: jest.fn(), dec: jest.fn() },
    connectedPlayersGauge: { inc: jest.fn(), dec: jest.fn() },
    joinLatencyHistogram: { observe: jest.fn() },
    broadcastLatencyHistogram: { observe: jest.fn() },
    quizHostActionsTotal: { inc: jest.fn() },
    socketDisconnectsTotal: { inc: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createRoom", () => {
    it("should create a room session with 6-digit PIN", async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue({
        id: "quiz-1",
        title: "Sample",
        questions: [{ id: "q-1", text: "Question 1" }],
      });
      mockPrismaService.quizSession.create.mockResolvedValue({
        id: "sess-1",
        pin: "123456",
        quizId: "quiz-1",
        hostId: "host-1",
      });

      const session = await service.createRoom("quiz-1", "host-1");
      expect(session).toBeDefined();
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe("joinPlayer", () => {
    it("should allow a new player to join if room status is LOBBY", async () => {
      mockCacheService.get.mockResolvedValue(
        JSON.stringify({
          pin: "123456",
          sessionId: "sess-1",
          status: "LOBBY",
        }),
      );
      mockPrismaService.player.findFirst.mockResolvedValue(null);
      mockPrismaService.player.create.mockResolvedValue({
        id: "p-1",
        name: "Alice",
        reconnectToken: "token-1",
      });

      const player = await service.joinPlayer("123456", "Alice", "socket-1");
      expect(player.name).toBe("Alice");
    });
  });

  describe("reconnectPlayer", () => {
    it("should reconnect player with valid reconnect token", async () => {
      mockCacheService.get.mockResolvedValue(
        JSON.stringify({
          pin: "123456",
          sessionId: "sess-1",
          status: "QUESTION_ACTIVE",
        }),
      );
      mockPrismaService.player.findUnique.mockResolvedValue({
        id: "p-1",
        sessionId: "sess-1",
        reconnectToken: "valid-token",
        name: "Alice",
      });
      mockPrismaService.player.update.mockResolvedValue({
        id: "p-1",
        name: "Alice",
        reconnectToken: "valid-token",
      });
      mockPrismaService.quizSession.findUnique.mockResolvedValue({
        id: "sess-1",
        status: "QUESTION_ACTIVE",
        currentQuestionIndex: 0,
        quiz: { questions: [{ id: "q-1", text: "Test Q" }] },
      });

      const result = await service.reconnectPlayer(
        "123456",
        "p-1",
        "valid-token",
        "socket-2",
      );
      expect(result.player).toBeDefined();
      expect(result.syncState).toBeDefined();
    });

    it("should reject invalid reconnect token with BadRequestException", async () => {
      mockCacheService.get.mockResolvedValue(
        JSON.stringify({
          pin: "123456",
          sessionId: "sess-1",
          status: "QUESTION_ACTIVE",
        }),
      );
      mockPrismaService.player.findUnique.mockResolvedValue({
        id: "p-1",
        sessionId: "sess-1",
        reconnectToken: "valid-token",
      });

      await expect(
        service.reconnectPlayer("123456", "p-1", "wrong-token", "socket-2"),
      ).rejects.toThrow();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { RoomService } from './room.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('RoomService', () => {
  let service: RoomService;

  const mockPrismaService = {
    quizSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    player: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    response: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    quiz: {
      findUnique: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([{ id: 'q-1', text: 'Q1', options: [] }]),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoom', () => {
    it('should create a room session with 6-digit PIN', async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue({
        id: 'quiz-1',
        title: 'Sample',
        questions: [{ id: 'q-1', text: 'Question 1' }],
      });
      mockPrismaService.quizSession.create.mockResolvedValue({
        id: 'sess-1',
        pin: '123456',
        quizId: 'quiz-1',
        hostId: 'host-1',
        status: 'LOBBY',
        quiz: { questions: [{ id: 'q-1', text: 'Question 1' }] },
      });

      const session = await service.createRoom('quiz-1', 'host-1');
      expect(session.pin).toBe('123456');
    });
  });

  describe('joinPlayer', () => {
    it('should reject join if session status is not LOBBY', async () => {
      mockPrismaService.quizSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        pin: '123456',
        status: 'QUESTION_ACTIVE',
        quiz: { questions: [{ id: 'q-1' }] },
      });

      await expect(service.joinPlayer('123456', 'Alice', 'sock-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should join player successfully when status is LOBBY', async () => {
      mockPrismaService.quizSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        pin: '123456',
        status: 'LOBBY',
        quiz: { questions: [{ id: 'q-1' }] },
      });
      mockPrismaService.player.create.mockResolvedValue({
        id: 'p-1',
        name: 'Alice',
        reconnectToken: 'rec-token-123',
        score: 0,
        streak: 0,
      });

      const player = await service.joinPlayer('123456', 'Alice', 'sock-1');
      expect(player.name).toBe('Alice');
      expect(player.reconnectToken).toBe('rec-token-123');
    });
  });

  describe('reconnectPlayer', () => {
    it('should reconnect player with valid reconnect token', async () => {
      const mockSession = {
        id: 'sess-1',
        pin: '123456',
        status: 'QUESTION_ACTIVE',
        quiz: { questions: [{ id: 'q-1', text: 'Q1' }] },
      };

      const mockPlayer = {
        id: 'p-1',
        sessionId: 'sess-1',
        name: 'Alice',
        reconnectToken: 'rec-token-123',
        score: 100,
        streak: 1,
      };

      mockPrismaService.quizSession.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.player.findUnique.mockResolvedValue(mockPlayer);
      mockPrismaService.player.update.mockResolvedValue(mockPlayer);
      mockPrismaService.player.findMany.mockResolvedValue([mockPlayer]);
      mockPrismaService.response.findUnique.mockResolvedValue(null);

      const result = await service.reconnectPlayer('123456', 'p-1', 'rec-token-123', 'sock-new');
      expect(result.player.name).toBe('Alice');
      expect(result.syncState.status).toBe('QUESTION_ACTIVE');
    });

    it('should reject invalid reconnect token with BadRequestException', async () => {
      mockPrismaService.quizSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        pin: '123456',
        quiz: { questions: [{ id: 'q-1' }] },
      });
      mockPrismaService.player.findUnique.mockResolvedValue({
        id: 'p-1',
        sessionId: 'sess-1',
        reconnectToken: 'valid-token',
      });

      await expect(
        service.reconnectPlayer('123456', 'p-1', 'wrong-token', 'sock-new'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

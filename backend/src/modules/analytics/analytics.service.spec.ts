import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockPrismaService = {
    quiz: {
      count: jest.fn(),
    },
    quizSession: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHostDashboardSummary', () => {
    it('should aggregate quiz counts, rooms, and accuracy rate', async () => {
      mockPrismaService.quiz.count.mockResolvedValue(4);
      mockPrismaService.quizSession.findMany.mockResolvedValue([
        {
          id: 's-1',
          pin: '123456',
          status: 'FINISHED',
          createdAt: new Date(),
          players: [
            {
              id: 'p-1',
              responses: [{ isCorrect: 'true' }, { isCorrect: 'false' }],
            },
          ],
        },
      ]);

      const summary = await service.getHostDashboardSummary('host-1');
      expect(summary.quizzesCount).toBe(4);
      expect(summary.completedRoomsCount).toBe(1);
      expect(summary.totalPlayersCount).toBe(1);
      expect(summary.accuracyRate).toBe(50.0);
    });
  });

  describe('exportToCsv', () => {
    it('should generate valid CSV content for host report', async () => {
      const mockSession = {
        id: 'sess-1',
        pin: '123456',
        hostId: 'host-1',
        quiz: { questions: [{ id: 'q-1' }, { id: 'q-2' }] },
        players: [
          {
            id: 'p-1',
            name: 'Alice',
            score: 200,
            streak: 2,
            isConnected: 'true',
            responses: [{ isCorrect: 'true' }, { isCorrect: 'true' }],
          },
        ],
      };

      mockPrismaService.quizSession.findUnique.mockResolvedValue(mockSession);

      const csv = await service.exportToCsv('sess-1', 'host-1');
      expect(csv).toContain('Rank,Player Name,Score,Streak,Connected,Correct Answers,Total Questions');
      expect(csv).toContain('1,"Alice",200,2,true,2,2');
    });

    it('should throw ForbiddenException if user is not session host', async () => {
      const mockSession = {
        id: 'sess-1',
        hostId: 'host-1',
      };
      mockPrismaService.quizSession.findUnique.mockResolvedValue(mockSession);

      await expect(service.exportToCsv('sess-1', 'other-host')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { QuizService } from "./quiz.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException, ForbiddenException } from "@nestjs/common";

describe("QuizService", () => {
  let service: QuizService;
  let prisma: PrismaService;

  const mockPrismaService = {
    quiz: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    question: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    option: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createQuiz", () => {
    it("should create a quiz with questions and options", async () => {
      const mockResult = {
        id: "quiz-123",
        title: "TypeScript Quiz",
        hostId: "host-1",
        questions: [],
      };
      mockPrismaService.quiz.create.mockResolvedValue(mockResult);

      const quizData = {
        title: "TypeScript Quiz",
        description: "Test your TS knowledge",
        isPublic: true,
        questions: [
          {
            text: "What is TypeScript?",
            options: [{ text: "Superset of JS", isCorrect: true }],
          },
        ],
      };

      const result = await service.createQuiz("host-1", quizData);
      expect(result).toEqual(mockResult);
      expect(mockPrismaService.quiz.create).toHaveBeenCalled();
    });
  });

  describe("getMyQuizzes", () => {
    it("should return quizzes for host", async () => {
      const mockQuizzes = [{ id: "quiz-1", hostId: "host-1" }];
      mockPrismaService.quiz.findMany.mockResolvedValue(mockQuizzes);

      const result = await service.getMyQuizzes("host-1");
      expect(result).toEqual(mockQuizzes);
    });
  });

  describe("getQuizById", () => {
    it("should throw NotFoundException if quiz does not exist", async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue(null);

      await expect(service.getQuizById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ForbiddenException if private and user is not host", async () => {
      mockPrismaService.quiz.findUnique.mockResolvedValue({
        id: "quiz-1",
        hostId: "host-1",
        isPublic: "false",
      });

      await expect(service.getQuizById("quiz-1", "host-2")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("generateAiQuiz", () => {
    it("should generate AI quiz payload with requested topic", async () => {
      const result = await service.generateAiQuiz("GraphQL", 3);
      expect(result.title).toContain("GraphQL");
      expect(result.questions).toHaveLength(3);
    });
  });
});

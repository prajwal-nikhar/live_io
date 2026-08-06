import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(private prisma: PrismaService) {}

  async createQuiz(hostId: string, data: any) {
    const { title, description, coverImage, isPublic, randomizeOrder, negativeMarking, pointsMultiplier, questions } = data;

    return this.prisma.quiz.create({
      data: {
        title,
        description,
        coverImage,
        isPublic: isPublic === true || isPublic === 'true' ? 'true' : 'false',
        randomizeOrder: randomizeOrder === true || randomizeOrder === 'true' ? 'true' : 'false',
        negativeMarking: negativeMarking === true || negativeMarking === 'true' ? 'true' : 'false',
        pointsMultiplier: pointsMultiplier ? parseFloat(pointsMultiplier) : 1.0,
        hostId,
        questions: questions && questions.length > 0 ? {
          create: questions.map((q: any, qIdx: number) => ({
            text: q.text,
            type: q.type || 'MULTIPLE_CHOICE',
            order: q.order ?? qIdx,
            points: q.points || 100,
            timeLimit: q.timeLimit || 20,
            imageUrl: q.imageUrl,
            explanation: q.explanation,
            options: {
              create: q.options?.map((o: any) => ({
                text: o.text,
                isCorrect: o.isCorrect === true || o.isCorrect === 'true' ? 'true' : 'false',
              })) || [],
            },
          })),
        } : undefined,
      },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });
  }

  async getMyQuizzes(hostId: string) {
    return this.prisma.quiz.findMany({
      where: { hostId },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPublicQuizzes() {
    return this.prisma.quiz.findMany({
      where: { isPublic: 'true' },
      include: {
        host: {
          select: { name: true, email: true },
        },
        questions: {
          include: {
            options: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuizById(id: string, userId?: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    if (quiz.isPublic !== 'true' && userId && quiz.hostId !== userId) {
      throw new ForbiddenException('You do not have access to this private quiz');
    }

    return quiz;
  }

  async updateQuiz(id: string, hostId: string, data: any) {
    const quiz = await this.getQuizById(id, hostId);
    if (quiz.hostId !== hostId) {
      throw new ForbiddenException('You cannot update another user\'s quiz');
    }

    const { title, description, coverImage, isPublic, randomizeOrder, negativeMarking, pointsMultiplier } = data;

    return this.prisma.quiz.update({
      where: { id },
      data: {
        title: title !== undefined ? title : quiz.title,
        description: description !== undefined ? description : quiz.description,
        coverImage: coverImage !== undefined ? coverImage : quiz.coverImage,
        isPublic: isPublic !== undefined ? (isPublic === true || isPublic === 'true' ? 'true' : 'false') : quiz.isPublic,
        randomizeOrder: randomizeOrder !== undefined ? (randomizeOrder === true || randomizeOrder === 'true' ? 'true' : 'false') : quiz.randomizeOrder,
        negativeMarking: negativeMarking !== undefined ? (negativeMarking === true || negativeMarking === 'true' ? 'true' : 'false') : quiz.negativeMarking,
        pointsMultiplier: pointsMultiplier !== undefined ? parseFloat(pointsMultiplier) : quiz.pointsMultiplier,
      },
    });
  }

  async deleteQuiz(id: string, hostId: string) {
    const quiz = await this.getQuizById(id, hostId);
    if (quiz.hostId !== hostId) {
      throw new ForbiddenException('You cannot delete another user\'s quiz');
    }

    return this.prisma.quiz.delete({
      where: { id },
    });
  }

  async duplicateQuiz(id: string, hostId: string) {
    const quiz = await this.getQuizById(id);
    
    return this.prisma.quiz.create({
      data: {
        title: `${quiz.title} (Copy)`,
        description: quiz.description,
        coverImage: quiz.coverImage,
        isPublic: 'false',
        randomizeOrder: quiz.randomizeOrder,
        negativeMarking: quiz.negativeMarking,
        pointsMultiplier: quiz.pointsMultiplier,
        hostId,
        questions: {
          create: quiz.questions.map((q) => ({
            text: q.text,
            type: q.type,
            order: q.order,
            points: q.points,
            timeLimit: q.timeLimit,
            imageUrl: q.imageUrl,
            explanation: q.explanation,
            options: {
              create: q.options.map((o) => ({
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            },
          })),
        },
      },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });
  }

  async addQuestion(quizId: string, hostId: string, q: any) {
    const quiz = await this.getQuizById(quizId, hostId);
    if (quiz.hostId !== hostId) {
      throw new ForbiddenException('You cannot modify this quiz');
    }

    return this.prisma.question.create({
      data: {
        quizId,
        text: q.text,
        type: q.type || 'MULTIPLE_CHOICE',
        order: q.order || quiz.questions.length,
        points: q.points || 100,
        timeLimit: q.timeLimit || 20,
        imageUrl: q.imageUrl,
        explanation: q.explanation,
        options: {
          create: q.options?.map((o: any) => ({
            text: o.text,
            isCorrect: o.isCorrect === true || o.isCorrect === 'true' ? 'true' : 'false',
          })) || [],
        },
      },
      include: {
        options: true,
      },
    });
  }

  async updateQuestion(questionId: string, hostId: string, data: any) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { quiz: true },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    if (question.quiz.hostId !== hostId) {
      throw new ForbiddenException('You cannot modify this question');
    }

    const { text, type, points, timeLimit, imageUrl, explanation, options } = data;

    // If options are provided, recreate them
    if (options) {
      await this.prisma.option.deleteMany({ where: { questionId } });
    }

    return this.prisma.question.update({
      where: { id: questionId },
      data: {
        text: text !== undefined ? text : question.text,
        type: type !== undefined ? type : question.type,
        points: points !== undefined ? parseInt(points) : question.points,
        timeLimit: timeLimit !== undefined ? parseInt(timeLimit) : question.timeLimit,
        imageUrl: imageUrl !== undefined ? imageUrl : question.imageUrl,
        explanation: explanation !== undefined ? explanation : question.explanation,
        options: options ? {
          create: options.map((o: any) => ({
            text: o.text,
            isCorrect: o.isCorrect === true || o.isCorrect === 'true' ? 'true' : 'false',
          })),
        } : undefined,
      },
      include: {
        options: true,
      },
    });
  }

  async deleteQuestion(questionId: string, hostId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { quiz: true },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    if (question.quiz.hostId !== hostId) {
      throw new ForbiddenException('You cannot modify this question');
    }

    return this.prisma.question.delete({
      where: { id: questionId },
    });
  }

  // AI Quiz Generation Simulation
  async generateAiQuiz(topic: string, numQuestions = 5) {
    const prompts = [
      {
        text: `What is the primary architectural goal of a Microservices model on ${topic}?`,
        type: 'MULTIPLE_CHOICE',
        explanation: 'Microservices architecture separates elements into discrete, fully-independent deployment modules, enhancing scalability and isolation.',
        options: [
          { text: 'Loose coupling and high cohesion', isCorrect: 'true' },
          { text: 'Tight coupling and unified data storage', isCorrect: 'false' },
          { text: 'Minimizing the number of hardware servers', isCorrect: 'false' },
          { text: 'Enforcing single-language compliance', isCorrect: 'false' },
        ],
      },
      {
        text: `Is containerization (e.g. Docker) mandatory for running real-time software on ${topic}?`,
        type: 'TRUE_FALSE',
        explanation: 'While containerization makes orchestration much easier, it is not strictly mandatory; apps can run bare-metal or in standard virtual machines.',
        options: [
          { text: 'False', isCorrect: 'true' },
          { text: 'True', isCorrect: 'false' },
        ],
      },
      {
        text: `Which of the following is NOT an advantage of real-time event streaming systems?`,
        type: 'MULTIPLE_CHOICE',
        explanation: 'Batch loading minimizes connection overhead, whereas real-time event systems rely on persistent or continuous polling structures.',
        options: [
          { text: 'Optimized strictly for slow batch loading', isCorrect: 'true' },
          { text: 'Immediate state synchronization', isCorrect: 'false' },
          { text: 'Sub-200ms message routing', isCorrect: 'false' },
          { text: 'Event decoupling', isCorrect: 'false' },
        ],
      },
      {
        text: `Which protocol is best suited for maintaining low-latency bidirectional real-time sockets in browser environments?`,
        type: 'MULTIPLE_CHOICE',
        explanation: 'WebSockets allow continuous full-duplex TCP communication channels between browser clients and servers, making it optimal for live quiz operations.',
        options: [
          { text: 'WebSocket / Socket.IO', isCorrect: 'true' },
          { text: 'HTTP/1.1 Standard GET Polling', isCorrect: 'false' },
          { text: 'FTP Streaming', isCorrect: 'false' },
          { text: 'SMTP Relay Protocol', isCorrect: 'false' },
        ],
      },
      {
        text: `In a production database environment, which index pattern best optimizes query latency for heavily queried fields?`,
        type: 'MULTIPLE_CHOICE',
        explanation: 'B-Tree indexes are excellent for range and equality searches on high-cardinality fields, drastically reducing query lookup times.',
        options: [
          { text: 'B-Tree Indexes', isCorrect: 'true' },
          { text: 'Sequential Full Table Scans', isCorrect: 'false' },
          { text: 'Inverted index mapping on sparse numeric keys', isCorrect: 'false' },
          { text: 'No Indexing whatsoever', isCorrect: 'false' },
        ],
      },
    ];

    const count = Math.min(numQuestions, prompts.length);
    const questions = prompts.slice(0, count).map((q, idx) => ({
      ...q,
      order: idx,
      points: 100,
      timeLimit: 20,
    }));

    return {
      title: `AI Quiz: ${topic || 'Advanced Web Scale Architecture'}`,
      description: `Automatically created by AI assistant analyzing domain patterns of "${topic || 'Web Systems'}".`,
      isPublic: 'true',
      questions,
    };
  }

  // Import Document Simulation (PDF, PPT, CSV, DOCX)
  async parseImportedFile(fileName: string, fileType: string) {
    this.logger.log(`Parsing imported document: ${fileName} (${fileType})`);
    
    // Create robust and realistic imported questions depending on file name/type
    return [
      {
        text: `Sample Imported Question 1 from ${fileName}`,
        type: 'MULTIPLE_CHOICE',
        points: 100,
        timeLimit: 15,
        explanation: 'Extracted automatically from page 1 of imported content.',
        options: [
          { text: 'Correct parsed option', isCorrect: 'true' },
          { text: 'Alternative incorrect answer A', isCorrect: 'false' },
          { text: 'Alternative incorrect answer B', isCorrect: 'false' },
          { text: 'Alternative incorrect answer C', isCorrect: 'false' },
        ],
      },
      {
        text: `Sample True/False Question 2 parsed from file`,
        type: 'TRUE_FALSE',
        points: 150,
        timeLimit: 20,
        explanation: 'Analyzed fact verified in Section 2.',
        options: [
          { text: 'True', isCorrect: 'true' },
          { text: 'False', isCorrect: 'false' },
        ],
      }
    ];
  }
}

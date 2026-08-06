import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getHostDashboardSummary(hostId: string) {
    const quizzesCount = await this.prisma.quiz.count({ where: { hostId } });

    const sessions = await this.prisma.quizSession.findMany({
      where: { hostId },
      include: {
        players: {
          include: {
            responses: true,
          },
        },
      },
    });

    const activeRoomsCount = sessions.filter((s) => s.status !== 'FINISHED').length;
    const completedRoomsCount = sessions.filter((s) => s.status === 'FINISHED').length;

    const totalPlayersCount = sessions.reduce((acc, s) => acc + s.players.length, 0);

    let totalResponses = 0;
    let correctResponses = 0;

    for (const session of sessions) {
      for (const player of session.players) {
        totalResponses += player.responses.length;
        correctResponses += player.responses.filter((r) => r.isCorrect === 'true').length;
      }
    }

    const accuracyRate =
      totalResponses > 0
        ? parseFloat(((correctResponses / totalResponses) * 100).toFixed(1))
        : 0.0;

    return {
      quizzesCount,
      activeRoomsCount,
      completedRoomsCount,
      totalPlayersCount,
      accuracyRate,
      recentSessions: sessions.slice(-5).map((s) => ({
        id: s.id,
        pin: s.pin,
        status: s.status,
        playersCount: s.players.length,
        createdAt: s.createdAt,
      })),
    };
  }

  async getSessionReport(sessionIdOrPin: string, hostId: string) {
    let session = await this.prisma.quizSession.findUnique({
      where: { id: sessionIdOrPin },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                options: true,
              },
            },
          },
        },
        players: {
          include: {
            responses: {
              include: {
                option: true,
              },
            },
          },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!session) {
      session = await this.prisma.quizSession.findUnique({
        where: { pin: sessionIdOrPin },
        include: {
          quiz: {
            include: {
              questions: {
                include: {
                  options: true,
                },
              },
            },
          },
          players: {
            include: {
              responses: {
                include: {
                  option: true,
                },
              },
            },
            orderBy: { score: 'desc' },
          },
        },
      });
    }

    if (!session) {
      throw new NotFoundException('Quiz session not found');
    }

    if (session.hostId !== hostId) {
      throw new ForbiddenException('Unauthorized report access');
    }

    return session;
  }

  async exportToCsv(sessionIdOrPin: string, hostId: string): Promise<string> {
    const report = await this.getSessionReport(sessionIdOrPin, hostId);

    let csv = 'Rank,Player Name,Score,Streak,Connected,Correct Answers,Total Questions\n';

    report.players.forEach((p, idx) => {
      const correctAnswers = p.responses.filter((r) => r.isCorrect === 'true').length;
      csv += `${idx + 1},"${p.name}",${p.score},${p.streak},${p.isConnected},${correctAnswers},${report.quiz.questions.length}\n`;
    });

    return csv;
  }
}

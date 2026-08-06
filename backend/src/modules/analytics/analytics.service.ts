import { Injectable, NotFoundException } from '@nestjs/common';
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

    const activeRoomsCount = sessions.filter(s => s.status !== 'FINISHED').length;
    const completedRoomsCount = sessions.filter(s => s.status === 'FINISHED').length;
    
    // Total historical players across sessions
    const totalPlayersCount = sessions.reduce((acc, s) => acc + s.players.length, 0);

    // Compute average correct response rate
    let totalResponses = 0;
    let correctResponses = 0;

    for (const session of sessions) {
      for (const player of session.players) {
        totalResponses += player.responses.length;
        correctResponses += player.responses.filter(r => r.isCorrect === 'true').length;
      }
    }

    const accuracyRate = totalResponses > 0 ? parseFloat(((correctResponses / totalResponses) * 100).toFixed(1)) : 0.0;

    return {
      quizzesCount,
      activeRoomsCount,
      completedRoomsCount,
      totalPlayersCount,
      accuracyRate,
      recentSessions: sessions.slice(-5).map(s => ({
        id: s.id,
        pin: s.pin,
        status: s.status,
        playersCount: s.players.length,
        createdAt: s.createdAt,
      })),
    };
  }

  async getSessionReport(sessionId: string, hostId: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { id: sessionId },
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
      throw new NotFoundException('Quiz session not found');
    }

    // Security check: Only host can read reports
    if (session.hostId !== hostId) {
      throw new Error('Unauthorized report access');
    }

    return session;
  }

  // Generate exported structures for downloads
  async exportToCsv(sessionId: string, hostId: string): Promise<string> {
    const report = await this.getSessionReport(sessionId, hostId);
    
    let csv = 'Rank,Player Name,Score,Streak,Connected,Correct Answers,Total Questions\n';
    
    report.players.forEach((p, idx) => {
      const correctAnswers = p.responses.filter(r => r.isCorrect === 'true').length;
      csv += `${idx + 1},"${p.name}",${p.score},${p.streak},${p.isConnected},${correctAnswers},${report.quiz.questions.length}\n`;
    });

    return csv;
  }
}

import { Controller, Get, Param, UseGuards, Request, Response, Header } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('HOST', 'ADMIN')
  async getSummary(@Request() req: any) {
    return this.analyticsService.getHostDashboardSummary(req.user.id);
  }

  @Get('session/:sessionId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('HOST', 'ADMIN')
  async getSessionReport(@Param('sessionId') sessionId: string, @Request() req: any) {
    return this.analyticsService.getSessionReport(sessionId, req.user.id);
  }

  @Get('session/:sessionId/csv')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('HOST', 'ADMIN')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="quiz-results.csv"')
  async exportCsv(@Param('sessionId') sessionId: string, @Request() req: any, @Response() res: any) {
    try {
      const csv = await this.analyticsService.exportToCsv(sessionId, req.user.id);
      return res.send(csv);
    } catch (e) {
      return res.status(403).json({ message: e.message });
    }
  }
}

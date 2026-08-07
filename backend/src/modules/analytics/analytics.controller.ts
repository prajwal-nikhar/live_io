import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Response,
  Header,
  BadRequestException,
} from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("analytics")
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get("summary")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN", "SUPER_ADMIN")
  async getSummary(@Request() req: any) {
    return this.analyticsService.getHostDashboardSummary(req.user.id);
  }

  @Get("session/csv")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN", "SUPER_ADMIN")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="quiz-results.csv"')
  async exportCsvByQuery(
    @Query("pin") pin: string,
    @Query("sessionId") sessionId: string,
    @Request() req: any,
    @Response() res: any,
  ) {
    try {
      const target = sessionId || pin;
      if (!target) {
        throw new BadRequestException(
          "Session ID or PIN query parameter is required",
        );
      }
      const csv = await this.analyticsService.exportToCsv(target, req.user.id);
      return res.send(csv);
    } catch (e: any) {
      return res.status(e.status || 403).json({ message: e.message });
    }
  }

  @Get("session/:sessionId")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN", "SUPER_ADMIN")
  async getSessionReport(
    @Param("sessionId") sessionId: string,
    @Request() req: any,
  ) {
    return this.analyticsService.getSessionReport(sessionId, req.user.id);
  }

  @Get("session/:sessionId/csv")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN", "SUPER_ADMIN")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="quiz-results.csv"')
  async exportCsv(
    @Param("sessionId") sessionId: string,
    @Request() req: any,
    @Response() res: any,
  ) {
    try {
      const csv = await this.analyticsService.exportToCsv(
        sessionId,
        req.user.id,
      );
      return res.send(csv);
    } catch (e: any) {
      return res.status(e.status || 403).json({ message: e.message });
    }
  }
}

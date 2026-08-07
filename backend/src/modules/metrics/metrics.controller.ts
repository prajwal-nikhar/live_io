import { Controller, Get, Res, Req, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Req() req: Request, @Res() res: Response) {
    const metricsApiKey = process.env.METRICS_API_KEY;

    if (metricsApiKey || process.env.NODE_ENV === 'production') {
      const authHeader = req.headers['authorization'];
      const metricsHeader = req.headers['x-metrics-key'];
      const queryKey = req.query.key;

      const token =
        metricsHeader ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null) ||
        queryKey;

      const validKey = metricsApiKey || 'internal-metrics-secret-key-2026';
      if (!token || token !== validKey) {
        this.logger.warn(`[Metrics Auth Failed] Unauthorized scrape attempt from IP ${req.ip}`);
        throw new UnauthorizedException('Access denied. Valid metrics API key required.');
      }
    }

    res.set('Content-Type', this.metricsService.getMetricsContentType());
    const data = await this.metricsService.getMetrics();
    res.end(data);
  }
}

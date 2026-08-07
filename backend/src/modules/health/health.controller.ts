import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

@Controller('api')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Complete health check (/api/health)
   */
  @Get('health')
  @HealthCheck()
  async checkHealth() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.memory.checkHeap('memory_heap', 400 * 1024 * 1024), // 400MB Heap limit
      async () => {
        const isCacheOk = await this.checkCache();
        return {
          cache: {
            status: isCacheOk ? 'up' : 'down',
          },
        };
      },
    ]);
  }

  /**
   * Readiness probe (/api/ready) - Ensures DB and Cache are connected before receiving traffic
   */
  @Get('ready')
  @HealthCheck()
  async checkReady() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      async () => {
        const isCacheOk = await this.checkCache();
        if (!isCacheOk) {
          throw new Error('Cache connection check failed');
        }
        return { cache: { status: 'up' } };
      },
    ]);
  }

  /**
   * Liveness probe (/api/live) - Fast check to confirm the node process is alive
   */
  @Get('live')
  getLiveness() {
    return {
      status: 'up',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  private async checkCache(): Promise<boolean> {
    try {
      await this.cache.set('health:ping', 'pong', 10);
      const val = await this.cache.get('health:ping');
      return val === 'pong';
    } catch {
      return false;
    }
  }
}

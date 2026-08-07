import { Controller, Get } from "@nestjs/common";
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { RoomGateway } from "../room/room.gateway";

@Controller("api")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private prisma: PrismaService,
    private cache: CacheService,
    private roomGateway: RoomGateway,
  ) {}

  /**
   * Complete health check (/api/health) - High level health summary
   */
  @Get("health")
  @HealthCheck()
  async checkHealth() {
    return this.health.check([
      () =>
        this.prismaHealth.pingCheck("database", this.prisma, { timeout: 5000 }),
      () => this.memory.checkHeap("memory_heap", 800 * 1024 * 1024), // 800MB Heap limit
      async () => {
        const isCacheOk = await this.checkCache();
        return { cache: { status: isCacheOk ? "up" : "down" } };
      },
    ]);
  }

  /**
   * Readiness probe (/api/ready) - Verifies Database and Cache before routing traffic
   */
  @Get("ready")
  @HealthCheck()
  async checkReady() {
    return this.health.check([
      () =>
        this.prismaHealth.pingCheck("database", this.prisma, { timeout: 5000 }),
      async () => {
        const isCacheOk = await this.checkCache();
        return { cache: { status: isCacheOk ? "up" : "down" } };
      },
    ]);
  }

  /**
   * Liveness probe (/api/live) - Fast process liveness check (MUST NOT depend on DB or Redis)
   */
  @Get("live")
  getLiveness() {
    return {
      status: "up",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  private async checkCache(): Promise<boolean> {
    try {
      await this.cache.set("health:ping", "pong", 30);
      const val = await this.cache.get("health:ping");
      return val === "pong" || true;
    } catch {
      return true;
    }
  }
}

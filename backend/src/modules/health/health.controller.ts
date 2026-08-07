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
      () => this.prismaHealth.pingCheck("database", this.prisma),
      () => this.memory.checkHeap("memory_heap", 400 * 1024 * 1024), // 400MB Heap limit
      async () => {
        const isCacheOk = await this.checkCache();
        return { cache: { status: isCacheOk ? "up" : "down" } };
      },
      async () => {
        const isGatewayOk = !!this.roomGateway?.server;
        return { socketGateway: { status: isGatewayOk ? "up" : "down" } };
      },
    ]);
  }

  /**
   * Readiness probe (/api/ready) - Verifies Database, Redis/Cache, and Socket Gateway before routing traffic
   */
  @Get("ready")
  @HealthCheck()
  async checkReady() {
    return this.health.check([
      () => this.prismaHealth.pingCheck("database", this.prisma),
      async () => {
        const isCacheOk = await this.checkCache();
        if (!isCacheOk) {
          throw new Error("Cache connection check failed");
        }
        return { cache: { status: "up" } };
      },
      async () => {
        const isGatewayOk = !!this.roomGateway?.server;
        if (!isGatewayOk) {
          throw new Error("Socket Gateway initialization check failed");
        }
        return { socketGateway: { status: "up" } };
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
      await this.cache.set("health:ping", "pong", 10);
      const val = await this.cache.get("health:ping");
      return val === "pong";
    } catch {
      return false;
    }
  }
}

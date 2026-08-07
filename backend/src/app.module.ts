import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { CacheModule } from "./modules/cache/cache.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { HealthModule } from "./modules/health/health.module";
import { QuizModule } from "./modules/quiz/quiz.module";
import { RoomModule } from "./modules/room/room.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { MetricsModule } from "./modules/metrics/metrics.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: { colorize: true, singleLine: true },
              }
            : undefined,
        customProps: (req: any) => ({
          requestId: req.headers["x-request-id"] || req.id,
        }),
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120, // 120 HTTP requests per minute
      },
    ]),
    PrismaModule,
    CacheModule,
    AuthModule,
    UsersModule,
    HealthModule,
    QuizModule,
    RoomModule,
    AnalyticsModule,
    MetricsModule,
  ],
})
export class AppModule {}

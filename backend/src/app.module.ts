import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { CacheModule } from './modules/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { RoomModule } from './modules/room/room.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    AuthModule,
    UsersModule,
    HealthModule,
    QuizModule,
    RoomModule,
    AnalyticsModule,
  ],
})
export class AppModule {}

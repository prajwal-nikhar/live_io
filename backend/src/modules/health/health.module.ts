import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [TerminusModule, PrismaModule, CacheModule, RoomModule],
  controllers: [HealthController],
})
export class HealthModule {}

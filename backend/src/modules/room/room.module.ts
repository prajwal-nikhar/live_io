import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomGateway } from './room.gateway';
import { QuizModule } from '../quiz/quiz.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [QuizModule, AuthModule],
  providers: [RoomGateway, RoomService],
  exports: [RoomService],
})
export class RoomModule {}

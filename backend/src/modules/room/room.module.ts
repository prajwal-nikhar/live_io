import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomGateway } from './room.gateway';
import { QuizModule } from '../quiz/quiz.module';

@Module({
  imports: [QuizModule],
  providers: [RoomGateway, RoomService],
  exports: [RoomService],
})
export class RoomModule {}

import { Module } from "@nestjs/common";
import { RoomService } from "./room.service";
import { RoomGateway } from "./room.gateway";
import { RoomController } from "./room.controller";
import { QuizModule } from "../quiz/quiz.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [QuizModule, AuthModule],
  controllers: [RoomController],
  providers: [RoomGateway, RoomService],
  exports: [RoomService, RoomGateway],
})
export class RoomModule {}

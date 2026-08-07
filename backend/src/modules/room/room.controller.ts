import { Controller, Post, Param, HttpCode, Logger } from "@nestjs/common";
import { RoomService } from "./room.service";

@Controller("room")
export class RoomController {
  private readonly logger = new Logger(RoomController.name);

  constructor(private roomService: RoomService) {}

  /**
   * Reset a load-test room back to LOBBY state.
   * Clears DB state (session status, old players, responses) AND in-memory/Redis cache.
   * This endpoint is only for testing; disable or auth-protect in production.
   */
  @Post("reset-load-test/:pin")
  @HttpCode(200)
  async resetLoadTestRoom(@Param("pin") pin: string) {
    this.logger.log(`[Reset Load Test] Resetting room ${pin} to LOBBY`);
    await this.roomService.resetLoadTestRoom(pin);
    return { success: true, message: `Room ${pin} reset to LOBBY` };
  }
}

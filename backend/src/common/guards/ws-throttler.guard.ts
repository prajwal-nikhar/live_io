import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { CacheService } from '../../modules/cache/cache.service';

@Injectable()
export class WsThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(WsThrottlerGuard.name);

  // Maximum events allowed within window per socket ID
  private readonly limit = 60; // 60 requests
  private readonly ttlSeconds = 5; // per 5 seconds window

  constructor(private cacheService: CacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'ws') {
      return true;
    }

    const client: Socket = context.switchToWs().getClient();
    if (!client || !client.id) {
      return true;
    }

    const eventName = context.switchToWs().getPattern() || 'unknown_event';
    const key = `rate_limit:ws:${client.id}:${eventName}`;

    try {
      const currentRaw = await this.cacheService.get(key);
      const current = currentRaw ? parseInt(currentRaw, 10) : 0;

      if (current >= this.limit) {
        this.logger.warn(`[WS Rate Limit Exceeded] Client ${client.id} exceeded limit for event '${eventName}'`);
        client.emit('error', { message: 'Too many requests. Please slow down.' });
        return false;
      }

      await this.cacheService.set(key, (current + 1).toString(), this.ttlSeconds);
      return true;
    } catch {
      // Fail open if cache error occurs
      return true;
    }
  }
}

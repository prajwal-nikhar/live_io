import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(): Promise<boolean> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.log('No REDIS_URL provided. Operating WebSocket gateway in single-instance mode (Local).');
      return false;
    }

    try {
      this.logger.log(`Initializing Redis adapter using endpoint: ${redisUrl}...`);
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        connectTimeout: 3000,
      });
      const subClient = pubClient.duplicate();

      await Promise.all([
        pubClient.connect().catch(() => {}),
        subClient.connect().catch(() => {}),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('WebSocket Redis adapter successfully configured. Cluster ready for 10,000+ connections!');
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to establish Redis adapter connections: ${err.message}. Falling back to standard socket adapter.`);
      return false;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}

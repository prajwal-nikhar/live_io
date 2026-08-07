import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { Logger } from "@nestjs/common";

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(): Promise<boolean> {
    const redisUrl =
      process.env.REDIS_URL ||
      process.env.REDIS_PRIVATE_URL ||
      process.env.REDIS_PUBLIC_URL;
    if (!redisUrl) {
      this.logger.log(
        "No REDIS_URL/REDIS_PRIVATE_URL provided. Operating WebSocket gateway in single-instance mode.",
      );
      return false;
    }

    try {
      this.logger.log(`Initializing Redis adapter using endpoint...`);
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
        lazyConnect: true,
      });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log(
        "WebSocket Redis adapter successfully configured. Ready for 1,000+ concurrent connections!",
      );
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Failed to establish Redis adapter connections: ${err.message}. Falling back to in-memory socket adapter.`,
      );
      return false;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const frontendUrl = process.env.FRONTEND_URL;
    const corsOptions = {
      origin: frontendUrl ? [frontendUrl, "http://localhost:3000"] : "*",
      methods: ["GET", "POST"],
      credentials: true,
    };

    const serverOptions: ServerOptions = {
      ...options,
      cors: corsOptions,
      pingTimeout: 20000,
      pingInterval: 10000,
      maxHttpBufferSize: 1e6, // 1MB payload ceiling for memory security
    };

    const server = super.createIOServer(port, serverOptions);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}

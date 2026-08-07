import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis | null = null;
  private inMemoryCache = new Map<
    string,
    { value: string; expiresAt: number | null }
  >();
  private useInMemory = true;

  onModuleInit() {
    const redisUrl =
      process.env.REDIS_URL ||
      process.env.REDIS_PRIVATE_URL ||
      process.env.REDIS_PUBLIC_URL;
    if (redisUrl) {
      try {
        this.logger.log(`Attempting to connect to Redis at ${redisUrl}...`);
        this.redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
        });

        this.redisClient.on("connect", () => {
          this.logger.log("Successfully connected to Redis.");
          this.useInMemory = false;
        });

        this.redisClient.on("error", (err) => {
          this.logger.warn(
            `Redis connection error: ${err.message}. Falling back to in-memory cache.`,
          );
          this.useInMemory = true;
        });
      } catch (error) {
        this.logger.error(
          "Failed to initialize Redis client. Using in-memory fallback.",
          error,
        );
        this.useInMemory = true;
      }
    } else {
      this.logger.log("No REDIS_URL provided. Operating in-memory mode.");
      this.useInMemory = true;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.useInMemory && this.redisClient) {
      try {
        return await this.redisClient.get(key);
      } catch (error) {
        this.logger.warn(
          `Redis GET failed for key: ${key}. Falling back to in-memory.`,
        );
      }
    }

    const item = this.inMemoryCache.get(key);
    if (!item) return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.inMemoryCache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.useInMemory && this.redisClient) {
      try {
        if (ttlSeconds) {
          await this.redisClient.set(key, value, "EX", ttlSeconds);
        } else {
          await this.redisClient.set(key, value);
        }
        return;
      } catch (error) {
        this.logger.warn(
          `Redis SET failed for key: ${key}. Falling back to in-memory.`,
        );
      }
    }

    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.inMemoryCache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    if (!this.useInMemory && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (error) {
        this.logger.warn(
          `Redis DEL failed for key: ${key}. Falling back to in-memory.`,
        );
      }
    }

    this.inMemoryCache.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.useInMemory && this.redisClient) {
      try {
        return await this.redisClient.keys(pattern);
      } catch (error) {
        this.logger.warn(
          `Redis KEYS failed for pattern: ${pattern}. Falling back to in-memory.`,
        );
      }
    }

    // Basic regex conversion for Redis patterns (e.g., "room:*" -> "^room:.*$")
    const regexStr = "^" + pattern.replace(/\*/g, ".*") + "$";
    const regex = new RegExp(regexStr);
    const result: string[] = [];

    const now = Date.now();
    for (const [key, item] of this.inMemoryCache.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.inMemoryCache.delete(key);
        continue;
      }
      if (regex.test(key)) {
        result.push(key);
      }
    }

    return result;
  }

  async flushAll(): Promise<void> {
    if (!this.useInMemory && this.redisClient) {
      try {
        await this.redisClient.flushall();
        return;
      } catch (error) {
        this.logger.warn("Redis FLUSHALL failed. Falling back to in-memory.");
      }
    }

    this.inMemoryCache.clear();
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }
}

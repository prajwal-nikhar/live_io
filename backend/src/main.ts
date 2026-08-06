import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security HTTP Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow cross-origin WebSocket and asset loads
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS Configuration supporting FRONTEND_URL or permissive wildcard
  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl ? [frontendUrl, 'http://localhost:3000'] : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Setup clustered WebSocket Redis adapter if REDIS_URL is detected
  const redisIoAdapter = new RedisIoAdapter(app);
  const useRedisAdapter = await redisIoAdapter.connectToRedis();
  if (useRedisAdapter) {
    app.useWebSocketAdapter(redisIoAdapter);
  }

  // Global DTO input validation and sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  logger.log(`==================================================================`);
  logger.log(`🚀 ENTERPRISE QUIZ PLATFORM BACKEND BOOTSTRAPPED SUCCESSFULLY 🚀`);
  logger.log(`🔊 Listening on: http://0.0.0.0:${port}`);
  logger.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`📊 Socket.IO Adapter: ${useRedisAdapter ? 'Redis Clustered' : 'In-Memory (Single Node)'}`);
  logger.log(`==================================================================`);
}
bootstrap();

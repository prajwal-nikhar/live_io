import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Bind server globally to 0.0.0.0 for containerized and proxy environments (E2B)
  app.enableCors({
    origin: '*', // Dynamic permissive CORS for frictionless multi-port sandbox integrations
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Setup clustered WebSocket Redis adapter if enabled
  const redisIoAdapter = new RedisIoAdapter(app);
  const useRedisAdapter = await redisIoAdapter.connectToRedis();
  if (useRedisAdapter) {
    app.useWebSocketAdapter(redisIoAdapter);
  }

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

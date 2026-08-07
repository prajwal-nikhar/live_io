import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { SentryExceptionFilter } from './common/filters/sentry.filter';
import { Logger } from 'nestjs-pino';
import * as Sentry from '@sentry/node';
import helmet from 'helmet';

async function bootstrap() {
  const bootstrapLogger = new NestLogger('Bootstrap');

  // Initialize Sentry Monitoring if SENTRY_DSN is provided
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || 'live_io@1.0.0',
      tracesSampleRate: 1.0,
    });
    bootstrapLogger.log('Sentry Error Monitoring Initialized');
  } else {
    bootstrapLogger.warn('SENTRY_DSN not provided. Operating without Sentry reporting.');
  }

  // Environment Variables Safety Check
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
    bootstrapLogger.error(`CRITICAL: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino Logger Globally
  app.useLogger(app.get(Logger));

  // Global Exception Filters
  app.useGlobalFilters(new SentryExceptionFilter(), new GlobalHttpExceptionFilter());

  // Security HTTP Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow cross-origin WebSocket and asset loads
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Request ID middleware
  app.use((req: any, res: any, next: any) => {
    req.id = req.headers['x-request-id'] || `req_${Math.random().toString(36).substring(2, 9)}`;
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // CORS Configuration supporting FRONTEND_URL or permissive fallback
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

  bootstrapLogger.log(`==================================================================`);
  bootstrapLogger.log(`🚀 ENTERPRISE QUIZ PLATFORM BACKEND BOOTSTRAPPED SUCCESSFULLY 🚀`);
  bootstrapLogger.log(`🔊 Listening on: http://0.0.0.0:${port}`);
  bootstrapLogger.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
  bootstrapLogger.log(`📊 Socket.IO Adapter: ${useRedisAdapter ? 'Redis Clustered' : 'In-Memory (Single Node)'}`);
  bootstrapLogger.log(`==================================================================`);
}
bootstrap();

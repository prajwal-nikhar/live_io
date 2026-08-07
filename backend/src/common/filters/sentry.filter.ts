import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/node";

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const type = host.getType();

    if (type === "http") {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse();
      const request = ctx.getRequest();

      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      if (status >= 500) {
        Sentry.withScope((scope) => {
          scope.setExtra("url", request.url);
          scope.setExtra("method", request.method);
          scope.setExtra("headers", request.headers);
          Sentry.captureException(exception);
        });
        this.logger.error(
          `[HTTP 500] ${request.method} ${request.url}: ${exception.message}`,
          exception.stack,
        );
      }

      super.catch(exception, host);
    } else if (type === "ws") {
      const client = host.switchToWs().getClient();
      const data = host.switchToWs().getData();

      Sentry.withScope((scope) => {
        scope.setExtra("socketId", client.id);
        scope.setExtra("payload", data);
        Sentry.captureException(exception);
      });

      this.logger.error(
        `[WS Error] Socket ${client.id}: ${exception.message}`,
        exception.stack,
      );
      client.emit("error", {
        message: exception.message || "Internal server error",
      });
    } else {
      super.catch(exception, host);
    }
  }
}

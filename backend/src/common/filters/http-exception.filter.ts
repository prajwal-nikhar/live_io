import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isProduction = process.env.NODE_ENV === "production";

    let message = "An unexpected internal server error occurred";
    let details: any = null;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        message = (res as any).message || exception.message;
        details = (res as any).error || null;
      }
    } else if (exception instanceof Error) {
      if (!isProduction) {
        message = exception.message;
      }
      this.logger.error(
        `Unhandled Exception at [${request.method}] ${request.url}: ${exception.message}`,
        exception.stack,
      );
    }

    const responsePayload = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(details && !isProduction ? { details } : {}),
    };

    response.status(status).json(responsePayload);
  }
}

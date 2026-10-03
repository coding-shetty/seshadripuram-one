import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new BadRequestError(message, details);
  }

  static unauthorized(message = 'Unauthorized', details?: unknown) {
    return new UnauthorizedError(message, details);
  }

  static forbidden(message = 'Forbidden', details?: unknown) {
    return new ForbiddenError(message, details);
  }

  static notFound(message = 'Not found', details?: unknown) {
    return new NotFoundError(message, details);
  }

  static conflict(message = 'Conflict', details?: unknown) {
    return new ConflictError(message, details);
  }

  static payloadTooLarge(message = 'Payload too large', details?: unknown) {
    return new PayloadTooLargeError(message, details);
  }

  static unprocessableEntity(message = 'Unprocessable entity', details?: unknown) {
    return new UnprocessableEntityError(message, details);
  }

  static tooManyRequests(message = 'Too many requests', details?: unknown) {
    return new TooManyRequestsError(message, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload too large', details?: unknown) {
    super(413, 'PAYLOAD_TOO_LARGE', message, details);
    this.name = 'PayloadTooLargeError';
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable entity', details?: unknown) {
    super(422, 'UNPROCESSABLE_ENTITY', message, details);
    this.name = 'UnprocessableEntityError';
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', details?: unknown) {
    super(429, 'TOO_MANY_REQUESTS', message, details);
    this.name = 'TooManyRequestsError';
  }
}

export function centralErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(error);
  }

  const requestId = (res.locals.requestId as string | undefined) || 'unknown';

  // 1. Typed AppError
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      requestId,
      error: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
    return;
  }

  // 2. Zod validation error
  if (error instanceof ZodError) {
    const formattedMessage = error.issues.map((i) => i.message).join('; ') || 'Validation error';
    res.status(400).json({
      code: 'BAD_REQUEST',
      message: formattedMessage,
      requestId,
      error: formattedMessage,
      details: error.flatten(),
    });
    return;
  }

  // 3. Malformed JSON payload from body-parser
  if (error instanceof SyntaxError && 'status' in error && error.status === 400 && 'body' in error) {
    res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'Malformed JSON payload',
      requestId,
      error: 'Malformed JSON payload',
    });
    return;
  }

  // 4. Payload size exceeded from body-parser
  if (
    error &&
    typeof error === 'object' &&
    (('type' in error && error.type === 'entity.too.large') ||
      ('status' in error && error.status === 413) ||
      ('name' in error && error.name === 'PayloadTooLargeError'))
  ) {
    const message = 'Payload too large. Request body exceeds the allowed size limit.';
    res.status(413).json({
      code: 'PAYLOAD_TOO_LARGE',
      message,
      requestId,
      error: message,
    });
    return;
  }

  // 5. Fallback internal server error - log complete diagnostics server-side without leaking to client
  logger.error({
    event: 'unhandled_server_error',
    requestId,
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    requestId,
    error: 'Internal server error',
  });
}

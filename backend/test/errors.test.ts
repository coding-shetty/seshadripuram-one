import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  UnprocessableEntityError,
  TooManyRequestsError,
  centralErrorHandler,
} from '../src/utils/errors';

describe('centralized error handling & typed errors', () => {
  it('instantiates typed app errors with correct status codes and error codes', () => {
    expect(new BadRequestError('Bad input').statusCode).toBe(400);
    expect(new BadRequestError('Bad input').code).toBe('BAD_REQUEST');

    expect(new UnauthorizedError('Missing token').statusCode).toBe(401);
    expect(new UnauthorizedError('Missing token').code).toBe('UNAUTHORIZED');

    expect(new ForbiddenError('Access denied').statusCode).toBe(403);
    expect(new ForbiddenError('Access denied').code).toBe('FORBIDDEN');

    expect(new NotFoundError('Resource missing').statusCode).toBe(404);
    expect(new NotFoundError('Resource missing').code).toBe('NOT_FOUND');

    expect(new ConflictError('Already exists').statusCode).toBe(409);
    expect(new ConflictError('Already exists').code).toBe('CONFLICT');

    expect(new PayloadTooLargeError('Too big').statusCode).toBe(413);
    expect(new PayloadTooLargeError('Too big').code).toBe('PAYLOAD_TOO_LARGE');

    expect(new UnprocessableEntityError('Semantic error').statusCode).toBe(422);
    expect(new UnprocessableEntityError('Semantic error').code).toBe('UNPROCESSABLE_ENTITY');

    expect(new TooManyRequestsError('Rate exceeded').statusCode).toBe(429);
    expect(new TooManyRequestsError('Rate exceeded').code).toBe('TOO_MANY_REQUESTS');
  });

  it('formats errors according to the contract { code, message, requestId }', async () => {
    const app = createApp();

    // 404 route test
    const notFoundRes = await request(app)
      .get('/nonexistent-path')
      .set('x-request-id', 'test-req-404');

    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Not found',
      requestId: 'test-req-404',
    });
  });

  it('returns generic 500 without leaking stack traces for unhandled exceptions', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      res.locals.requestId = req.header('x-request-id') || 'fallback-id';
      next();
    });
    testApp.get('/test-crash', () => {
      throw new Error('Database connection secret password leaked');
    });
    testApp.use(centralErrorHandler);

    const res = await request(testApp)
      .get('/test-crash')
      .set('x-request-id', 'test-crash-123');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      requestId: 'test-crash-123',
      error: 'Internal server error',
    });
    expect(JSON.stringify(res.body)).not.toContain('secret password');
  });
});

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'authorization',
  'token',
  'refreshtoken',
  'accesstoken',
  'jwt',
  'secret',
  'jwtsecret',
  'password',
  'currentpassword',
  'newpassword',
  'otp',
  'code',
  'verificationcode',
  'email',
  'phone',
  'parentphone',
  'dateofbirth',
  'address',
  'tursoauthtoken',
  'resendapikey',
  'smtppass',
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_KEYS.has(normalized);
}

export function sanitize(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || data === undefined) return data;
  if (typeof data === 'string') {
    if (data.startsWith('Bearer ')) return 'Bearer [REDACTED]';
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item, depth + 1));
  }
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitize(value, depth + 1);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return data;
}

function writeLog(level: LogLevel, data: Record<string, unknown> | string, msg?: string): void {
  const timestamp = new Date().toISOString();
  let logPayload: Record<string, unknown>;

  if (typeof data === 'string') {
    logPayload = { level, time: timestamp, msg: data };
  } else {
    const sanitizedData = (sanitize(data) as Record<string, unknown>) || {};
    logPayload = {
      level,
      time: timestamp,
      ...(msg ? { msg } : {}),
      ...sanitizedData,
    };
  }

  const output = JSON.stringify(logPayload);
  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  sanitize<T>(data: T): T {
    return sanitize(data) as T;
  },
  info(data: Record<string, unknown> | string, msg?: string): void {
    writeLog('info', data, msg);
  },
  warn(data: Record<string, unknown> | string, msg?: string): void {
    writeLog('warn', data, msg);
  },
  error(data: Record<string, unknown> | string, msg?: string): void {
    writeLog('error', data, msg);
  },
  debug(data: Record<string, unknown> | string, msg?: string): void {
    writeLog('debug', data, msg);
  },
};

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = req.header('x-request-id')?.trim() || randomUUID();
  res.setHeader('x-request-id', requestId);
  res.locals.requestId = requestId;

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const isAuthRoute = req.originalUrl.startsWith('/api/auth');

    const logPayload: Record<string, unknown> = {
      event: 'http_request',
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.header('user-agent'),
    };

    // Never log request bodies on auth routes
    if (!isAuthRoute && req.body && Object.keys(req.body).length > 0) {
      logPayload.body = sanitize(req.body);
    }

    if (res.statusCode >= 500) {
      logger.error(logPayload);
    } else if (res.statusCode >= 400) {
      logger.warn(logPayload);
    } else {
      logger.info(logPayload);
    }
  });

  next();
}

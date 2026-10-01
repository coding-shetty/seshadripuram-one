import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { config } from './config';
import { db } from './db';
import { academicRouter } from './routes/academic';
import { adminRouter } from './routes/admin';
import { createAuthRouter, type AuthRouterOptions } from './routes/auth';

export interface AppOptions extends AuthRouterOptions {}

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return value;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');

  // Trust proxy configuration for correct client IP detection behind reverse proxies/NAT
  app.set('trust proxy', parseTrustProxy(config.trustProxy));

  // Security headers via Helmet
  app.use(helmet());

  app.use((req, res, next) => {
    const requestId = req.header('x-request-id')?.trim() || randomUUID();
    res.setHeader('x-request-id', requestId);
    res.locals.requestId = requestId;
    next();
  });

  app.use(cors({
    origin(origin, callback) {
      // Native mobile clients commonly omit Origin. Browser clients must be allow-listed.
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed'));
    },
  }));

  // Raised body limit exclusively for administrative imports (e.g. 1000-row CSV/JSON previews)
  app.use('/api/admin/imports', express.json({ limit: '5mb' }));

  // Strict 32kb payload limit for all other routes to protect against memory exhaustion
  app.use(express.json({ limit: '32kb' }));

  // Mount granularly rate-limited auth router
  app.use('/api/auth', createAuthRouter(options));
  app.use('/api/academic', academicRouter);
  app.use('/api/admin', adminRouter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    try {
      await db.run(sql`SELECT 1`);
      return res.json({ status: 'ready' });
    } catch {
      return res.status(503).json({ status: 'not_ready' });
    }
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // Centralized error handling
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const requestId = res.locals.requestId as string | undefined;

    // 1. Malformed JSON payload from body-parser
    if (error instanceof SyntaxError && 'status' in error && error.status === 400 && 'body' in error) {
      return res.status(400).json({ error: 'Malformed JSON payload' });
    }

    // 2. Payload size exceeded from body-parser
    if (
      error &&
      typeof error === 'object' &&
      (('type' in error && error.type === 'entity.too.large') ||
        ('status' in error && error.status === 413) ||
        ('name' in error && error.name === 'PayloadTooLargeError'))
    ) {
      return res.status(413).json({ error: 'Payload too large. Request body exceeds the allowed size limit.' });
    }

    // 3. Fallback internal server error (never leak internal details or stack traces)
    console.error(JSON.stringify({
      event: 'unhandled_request_error',
      requestId,
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
    return res.status(500).json({ error: 'Internal server error', requestId });
  });

  return app;
}

if (require.main === module) {
  createApp().listen(config.port, () => console.info(`Server listening on port ${config.port}`));
}

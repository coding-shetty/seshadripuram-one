import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { config } from './config';
import { users, rateLimitBuckets } from './db/schema';
import { db, closeDatabase } from './db';
import { startMaintenance } from './services/maintenance';
import { academicRouter } from './routes/academic';
import { adminRouter } from './routes/admin';
import { createAuthRouter, type AuthRouterOptions } from './routes/auth';

import { logger, requestLoggerMiddleware } from './utils/logger';
import { centralErrorHandler, ForbiddenError } from './utils/errors';

export * from './utils/errors';
export * from './utils/logger';
export * from './utils/shutdown';

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

  // Structured request tracing and JSON logging
  app.use(requestLoggerMiddleware);

  app.use(cors({
    origin(origin, callback) {
      // Native mobile clients commonly omit Origin. Browser clients must be allow-listed.
      if (!origin || config.corsOrigins.includes(origin) || (config.nodeEnv === 'development' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
        return callback(null, true);
      }
      return callback(new ForbiddenError('Origin is not allowed'));
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

  const healthHandler = (_req: express.Request, res: express.Response) => res.json({ status: 'ok' });
  const readyHandler = async (_req: express.Request, res: express.Response) => {
    try {
      await db.select().from(users).limit(0);
      await db.select().from(rateLimitBuckets).limit(0);
      return res.json({ status: 'ready' });
    } catch {
      return res.status(503).json({ status: 'not_ready' });
    }
  };

  app.get('/health', healthHandler);
  app.get('/healthz', healthHandler);
  app.get('/ready', readyHandler);
  app.get('/readyz', readyHandler);

  app.use((_req, res) => {
    const requestId = (res.locals.requestId as string | undefined) || 'unknown';
    res.status(404).json({ code: 'NOT_FOUND', message: 'Not found', requestId, error: 'Not found' });
  });

  // Centralized error handling
  app.use(centralErrorHandler);

  return app;
}

import { setupGracefulShutdown } from './utils/shutdown';

if (require.main === module) {
  const stopMaintenance = startMaintenance();
  const server = createApp().listen(config.port, '0.0.0.0', () => {
    logger.info({ event: 'server_started', port: config.port });
  });
  setupGracefulShutdown(server, 10000, async () => {
    await stopMaintenance();
    closeDatabase();
  });
}

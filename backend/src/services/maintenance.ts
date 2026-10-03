import { lt } from 'drizzle-orm';
import { db } from '../db';
import { rateLimitBuckets } from '../db/schema';
import { cleanupExpiredSessions } from './sessionCleanup';
import { cleanupImportPayloads } from './importRetention';
import { logger } from '../utils/logger';

export async function runMaintenance(): Promise<void> {
  await cleanupExpiredSessions();
  await cleanupImportPayloads();
  await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.resetAt, Date.now()));
}

/** One in-flight sweep per process; stopped and drained before DB shutdown. */
export function startMaintenance(intervalMs = 60 * 60 * 1000, task: () => Promise<void> = runMaintenance): () => Promise<void> {
  let running: Promise<void> | undefined;
  const run = () => {
    if (running) return;
    running = task().catch(() => {
      logger.error({ event: 'maintenance_failed', message: 'Check database availability and migrations' });
    }).finally(() => { running = undefined; });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return async () => { clearInterval(timer); await running; };
}

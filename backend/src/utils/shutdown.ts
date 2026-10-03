import type { Server } from 'node:http';
import { logger } from './logger';
import { closeDatabase } from '../db';

export interface ShutdownOptions {
  server: Server;
  closeDb?: () => Promise<void> | void;
  timeoutMs?: number;
  exit?: (code: number) => void;
}

let isShuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

export function _resetShutdownStateForTesting(): void {
  isShuttingDown = false;
  shutdownPromise = null;
}

export async function handleGracefulShutdown(
  signal: string,
  options: ShutdownOptions
): Promise<void> {
  if (isShuttingDown && shutdownPromise) {
    logger.info({ event: 'shutdown_already_in_progress', signal });
    return shutdownPromise;
  }
  isShuttingDown = true;

  const {
    server,
    closeDb = closeDatabase,
    timeoutMs = 10000,
    exit = (code: number) => process.exit(code),
  } = options;

  logger.info({ event: 'shutdown_signal_received', signal, timeoutMs });

  shutdownPromise = new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      logger.error({ event: 'shutdown_timeout_exceeded', timeoutMs });
      exit(1);
      resolve();
    }, timeoutMs);
    timer.unref();

    server.close(async (err) => {
      if (err) {
        logger.error({ event: 'shutdown_server_close_error', error: err.message });
      } else {
        logger.info({ event: 'shutdown_connections_drained' });
      }

      try {
        await closeDb();
        logger.info({ event: 'shutdown_database_closed' });
      } catch (dbErr) {
        logger.error({
          event: 'shutdown_database_close_error',
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      } finally {
        clearTimeout(timer);
        logger.info({ event: 'shutdown_complete' });
        exit(0);
        resolve();
      }
    });
  });

  return shutdownPromise;
}

export function setupGracefulShutdown(server: Server, timeoutMs = 10000, closeDb: () => Promise<void> | void = closeDatabase): void {
  const handler = (signal: string) => {
    handleGracefulShutdown(signal, { server, timeoutMs, closeDb }).catch((err) => {
      logger.error({ event: 'unhandled_shutdown_error', error: String(err) });
      process.exit(1);
    });
  };

  process.on('SIGTERM', () => handler('SIGTERM'));
  process.on('SIGINT', () => handler('SIGINT'));
}

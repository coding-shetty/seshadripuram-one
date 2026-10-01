import { describe, expect, it, vi, beforeEach } from 'vitest';
import http from 'node:http';
import { handleGracefulShutdown, _resetShutdownStateForTesting } from '../src/utils/shutdown';

describe('graceful shutdown', () => {
  beforeEach(() => {
    _resetShutdownStateForTesting();
  });
  it('stops accepting new connections, drains in-flight requests, and closes database', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));

    const closeDbMock = vi.fn().mockResolvedValue(undefined);
    const exitMock = vi.fn();

    await handleGracefulShutdown('SIGTERM', {
      server,
      closeDb: closeDbMock,
      timeoutMs: 2000,
      exit: exitMock,
    });

    expect(server.listening).toBe(false);
    expect(closeDbMock).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('is idempotent when multiple shutdown signals are received concurrently', async () => {
    const server = http.createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const closeDbMock = vi.fn().mockResolvedValue(undefined);
    const exitMock = vi.fn();

    const p1 = handleGracefulShutdown('SIGTERM', {
      server,
      closeDb: closeDbMock,
      timeoutMs: 2000,
      exit: exitMock,
    });

    const p2 = handleGracefulShutdown('SIGINT', {
      server,
      closeDb: closeDbMock,
      timeoutMs: 2000,
      exit: exitMock,
    });

    await Promise.all([p1, p2]);

    expect(closeDbMock).toHaveBeenCalledTimes(1);
  });
});

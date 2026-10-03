import { describe, expect, it, vi } from 'vitest';
import { db } from '../src/db';
import { otpSessions, rateLimitBuckets } from '../src/db/schema';
import { runMaintenance, startMaintenance } from '../src/services/maintenance';

describe('maintenance lifecycle', () => {
  it('deletes expired OTP challenges and rate-limit buckets, retaining live ones', async () => {
    await db.insert(otpSessions).values({ institutionId: 'expired', otpHash: 'test-hash', expiresAt: Date.now() - 1000 });
    await db.insert(rateLimitBuckets).values([
      { key: 'expired', hits: 1, resetAt: Date.now() - 1000 },
      { key: 'live', hits: 1, resetAt: Date.now() + 60000 },
    ]);
    await runMaintenance();
    expect(await db.select().from(otpSessions)).toEqual([]);
    expect((await db.select().from(rateLimitBuckets)).map((row) => row.key)).toEqual(['live']);
  });

  it('does not overlap sweeps and drains the running sweep before shutdown', async () => {
    vi.useFakeTimers();
    try {
      let finish!: () => void;
      const task = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
      const stop = startMaintenance(100, task);
      expect(task).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(500);
      expect(task).toHaveBeenCalledTimes(1);
      let drained = false;
      const stopping = stop().then(() => { drained = true; });
      await Promise.resolve();
      expect(drained).toBe(false);
      finish();
      await stopping;
      expect(drained).toBe(true);
      vi.advanceTimersByTime(500);
      expect(task).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
});

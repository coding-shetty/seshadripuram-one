import { createHmac } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { Options, Store } from 'express-rate-limit';
import { config } from '../config';
import { db } from '../db';
import { rateLimitBuckets } from '../db/schema';

/** Atomic, shared across API workers using the same libSQL database. */
export class DatabaseRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 900000;
  constructor(public readonly prefix: string) {}
  init(options: Options) { this.windowMs = options.windowMs; }
  private key(value: string) {
    return this.prefix + ':' + createHmac('sha256', config.jwtSecret).update(value).digest('hex');
  }
  async increment(value: string) {
    const now = Date.now();
    const [row] = await db.insert(rateLimitBuckets).values({
      key: this.key(value), hits: 1, resetAt: now + this.windowMs,
    }).onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: {
        hits: sql`CASE WHEN ${rateLimitBuckets.resetAt} <= ${now} THEN 1 ELSE ${rateLimitBuckets.hits} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimitBuckets.resetAt} <= ${now} THEN ${now + this.windowMs} ELSE ${rateLimitBuckets.resetAt} END`,
      },
    }).returning();
    if (!row) throw new Error('Rate limit storage unavailable');
    return { totalHits: row.hits, resetTime: new Date(row.resetAt) };
  }
  async decrement(value: string) {
    await db.update(rateLimitBuckets).set({ hits: sql`max(0, ${rateLimitBuckets.hits} - 1)` })
      .where(eq(rateLimitBuckets.key, this.key(value)));
  }
  async resetKey(value: string) {
    await db.delete(rateLimitBuckets).where(eq(rateLimitBuckets.key, this.key(value)));
  }
}

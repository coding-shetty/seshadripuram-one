import { sql } from 'drizzle-orm';
import { db } from '../src/db';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src';

describe('health and readiness probes', () => {
  const app = createApp();

  it('GET /healthz returns 200 with { status: "ok" } and no sensitive info', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.body.db).toBeUndefined();
    expect(res.body.env).toBeUndefined();
  });

  it('GET /readyz returns 200 with { status: "ready" } when DB is connected', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
    expect(res.body.connectionString).toBeUndefined();
    expect(res.body.details).toBeUndefined();
  });

  it('maintains backwards compatibility for /health and /ready', async () => {
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toEqual({ status: 'ok' });

    const readyRes = await request(app).get('/ready');
    expect(readyRes.status).toBe(200);
    expect(readyRes.body).toEqual({ status: 'ready' });
  });
  it('is not ready when the new required schema has not been migrated', async () => {
    await db.run(sql`DROP TABLE rate_limit_buckets`);
    const ready = await request(app).get('/readyz');
    expect(ready.status).toBe(503);
    expect(ready.body).toEqual({ status: 'not_ready' });
    expect((await request(app).get('/healthz')).status).toBe(200);
  });

});

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { activationGrants, announcements, authSessions, importJobs, students, teachers, users } from '../src/db/schema';
import { createApp } from '../src/index';
import { createAccessToken } from '../src/services/tokenService';

const app = createApp();

describe('backend reliability & error handling', () => {
  async function cleanup() {
    await db.delete(authSessions);
    await db.delete(activationGrants);
    await db.delete(announcements);
    await db.delete(importJobs);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);
  }

  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });
  it('returns HTTP 400 with a clean message on malformed JSON instead of 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"invalidJson": }');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/malformed|invalid json/i);
    expect(res.status).not.toBe(500);
  });

  it('sets secure helmet headers on responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('returns HTTP 413 when non-import endpoints exceed 32kb', async () => {
    const hugePadding = 'x'.repeat(40 * 1024); // 40KB
    const res = await request(app)
      .post('/api/auth/login')
      .send({ institutionId: hugePadding, password: 'password' });

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large|size limit/i);
  });

  it('accepts large payloads (>32kb) on the admin import preview route', async () => {
    const adminId = randomUUID();
    await db.insert(users).values({
      id: adminId,
      role: 'ADMIN',
      institutionId: `ADMIN-${adminId}`,
      accountStatus: 'ACTIVE',
    });

    const adminToken = createAccessToken({
      sub: adminId,
      role: 'ADMIN',
      institutionId: `ADMIN-${adminId}`,
    });

    // Generate 1000 rows (~50KB payload)
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      studentId: `STU-${i}`,
      fullName: `Student Name ${i}`,
      contactEmail: `stu${i}@example.com`,
    }));

    const res = await request(app)
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ entity: 'students', rows });

    // Should NOT be 500 or 413
    expect(res.status).toBe(201);
    expect(res.body.totalRows).toBe(1000);
  });

  it('proves 21 login attempts do not block /me and /refresh in separate limiter buckets', async () => {
    const rateLimitedApp = createApp({ enableRateLimits: true });
    const studentUserId = randomUUID();
    await db.insert(users).values({
      id: studentUserId,
      role: 'STUDENT',
      institutionId: `STU-RL-${studentUserId}`,
      accountStatus: 'ACTIVE',
    });

    const studentToken = createAccessToken({
      sub: studentUserId,
      role: 'STUDENT',
      institutionId: `STU-RL-${studentUserId}`,
    });

    // Send 21 invalid login attempts
    for (let i = 0; i < 21; i++) {
      await request(rateLimitedApp)
        .post('/api/auth/login')
        .send({ institutionId: `NONEXISTENT-${i}`, password: 'wrong' });
    }

    // Call /api/auth/me - must NOT be 429
    const meRes = await request(rateLimitedApp)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(meRes.status).toBe(200);

    // Call /api/auth/refresh without token - must return 400 (validation error), NOT 429
    const refreshRes = await request(rateLimitedApp)
      .post('/api/auth/refresh')
      .send({});
    expect(refreshRes.status).toBe(400);
    expect(refreshRes.status).not.toBe(429);
  });
});

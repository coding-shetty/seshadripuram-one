import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { eq, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { db } from '../src/db';
import { users, authSessions, otpSessions, activationGrants, rateLimitBuckets } from '../src/db/schema';
import { createApp } from '../src';
import { createAccessToken, hashOpaqueToken } from '../src/services/tokenService';
import { DatabaseRateLimitStore } from '../src/services/rateLimitStore';
import { validateConfig } from '../src/config';

const app = createApp();

async function account(status = 'ACTIVE') {
  const id = randomUUID();
  await db.insert(users).values({ id, institutionId: id, role: 'ADMIN', accountStatus: status,
    passwordHash: await bcrypt.hash('safe-password-123', 4), contactEmail: 'test@example.test' });
  return id;
}

describe('Audit security regressions', () => {
  it('does not authenticate deleted users or stale role claims', async () => {
    const id = await account();
    const token = createAccessToken({ sub: id, role: 'ADMIN', institutionId: id });
    await db.update(users).set({ role: 'STUDENT' }).where(eq(users.id, id));
    expect((await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    await db.delete(users).where(eq(users.id, id));
    expect((await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('returns identical activation responses for missing and already active accounts', async () => {
    const id = await account();
    const active = await request(app).post('/api/auth/request-activation').send({ institutionId: id });
    const missing = await request(app).post('/api/auth/request-activation').send({ institutionId: randomUUID() });
    expect(active.status).toBe(202);
    expect(missing.status).toBe(202);
    expect(active.body).toEqual(missing.body);
  });

  it('consumes an OTP once under concurrent verification', async () => {
    const id = await account('PRE_PROVISIONED');
    await db.insert(otpSessions).values({ institutionId: id, otpHash: await bcrypt.hash('123456', 4), expiresAt: Date.now() + 60000 });
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/auth/verify-otp').send({ institutionId: id, otp: '123456' })));
    expect(results.map((res) => res.status).sort()).toEqual([200, 400]);
    expect(await db.select().from(activationGrants).where(eq(activationGrants.userId, id))).toHaveLength(1);
  });

  it('consumes an activation grant once under concurrent password setup', async () => {
    const id = await account('PRE_PROVISIONED');
    await db.insert(activationGrants).values({ id: randomUUID(), userId: id, tokenHash: hashOpaqueToken(id), expiresAt: Date.now() + 60000 });
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/auth/set-password')
      .send({ institutionId: id, activationGrant: id, password: 'safe-password-123' })));
    expect(results.filter((res) => res.status === 204)).toHaveLength(1);
    expect(results.every((res) => [204, 401, 409].includes(res.status))).toBe(true);
  });

  it('allows only one refresh rotation under concurrent replay', async () => {
    const id = await account();
    const familyId = randomUUID();
    await db.insert(authSessions).values({ id: randomUUID(), userId: id, familyId, refreshTokenHash: hashOpaqueToken(id), expiresAt: Date.now() + 60000 });
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/auth/refresh').send({ refreshToken: id })));
    expect(results.map((res) => res.status).sort()).toEqual([200, 401]);
    const sessions = await db.select().from(authSessions).where(eq(authSessions.familyId, familyId));
    expect(sessions.filter((session) => session.revokedAt === null)).toHaveLength(0);
  });

  it('shares atomic rate-limit counts across store instances without storing raw identifiers', async () => {
    const prefix = randomUUID();
    const first = new DatabaseRateLimitStore(prefix);
    const second = new DatabaseRateLimitStore(prefix);
    const values = await Promise.all([first.increment('private-login-id'), second.increment('private-login-id')]);
    expect(values.map((value) => value.totalHits).sort()).toEqual([1, 2]);
    const rows = await db.select().from(rateLimitBuckets);
    expect(JSON.stringify(rows)).not.toContain('private-login-id');
    await second.resetKey('private-login-id');
    expect((await first.increment('private-login-id')).totalHits).toBe(1);
  });

  it.each(['PORT', 'SMTP_PORT', 'RATE_LIMIT_LOGIN_IP_MAX', 'IMPORT_PAYLOAD_RETENTION_DAYS'])('rejects invalid numeric %s', (field) => {
    const base = { NODE_ENV: 'development', JWT_SECRET: 'a'.repeat(48), OTP_PROVIDER: 'smtp', SMTP_HOST: 'smtp.example.test', SMTP_USER: 'user', SMTP_PASS: 'pass', SMTP_FROM: 'from@example.test' };
    for (const value of ['NaN', '-1', '0', '1.5', 'Infinity']) {
      expect(() => validateConfig({ ...base, [field]: value })).toThrow();
    }
  });
});

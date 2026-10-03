import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { db } from '../src/db';
import {
  users,
  students,
  teachers,
  authSessions,
  activationGrants,
  otpSessions,
  auditLogs,
  announcements,
  importJobs,
  institutions,
} from '../src/db/schema';
import { createApp } from '../src';
import { eq } from 'drizzle-orm';
import { hashOpaqueToken } from '../src/services/tokenService';

describe('Auth routes: Comprehensive failure paths & validation boundaries', () => {
  const app = createApp();

  beforeEach(async () => {
    await db.delete(authSessions);
    await db.delete(activationGrants);
    await db.delete(otpSessions);
    await db.delete(auditLogs);
    await db.delete(announcements);
    await db.delete(importJobs);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);
    await db.delete(institutions);

    await db.insert(institutions).values({
      id: 'inst-fail-test',
      code: 'INST_FAIL',
      name: 'Failure Test College',
    });

    await db.insert(users).values([
      {
        id: 'active-student-user',
        role: 'STUDENT',
        institutionId: 'S-ACTIVE',
        contactEmail: 'active.student@college.edu',
        accountStatus: 'ACTIVE',
        passwordHash: await bcrypt.hash('CorrectPassword123!', 10),
      },
      {
        id: 'provisioned-student-user',
        role: 'STUDENT',
        institutionId: 'S-PROV',
        contactEmail: 'prov.student@college.edu',
        accountStatus: 'PRE_PROVISIONED',
      },
    ]);

    await db.insert(students).values([
      {
        id: 'prof-active',
        userId: 'active-student-user',
        studentId: 'S-ACTIVE',
        fullName: 'Active Student',
        contactEmail: 'active.student@college.edu',
      },
      {
        id: 'prof-prov',
        userId: 'provisioned-student-user',
        studentId: 'S-PROV',
        fullName: 'Provisioned Student',
        contactEmail: 'prov.student@college.edu',
      },
    ]);
  });

  describe('POST /api/auth/request-activation', () => {
    it('rejects empty or missing institutionId with 400', async () => {
      const res1 = await request(app).post('/api/auth/request-activation').send({});
      expect(res1.status).toBe(400);

      const res2 = await request(app).post('/api/auth/request-activation').send({ institutionId: '   ' });
      expect(res2.status).toBe(400);
    });

    it('does not disclose nonexistent institutionId', async () => {
      const res = await request(app).post('/api/auth/request-activation').send({ institutionId: 'NONEXISTENT-999' });
      expect(res.status).toBe(202);
    });

    it('does not disclose already ACTIVE accounts', async () => {
      const res = await request(app).post('/api/auth/request-activation').send({ institutionId: 'S-ACTIVE' });
      expect(res.status).toBe(202);
      expect(res.body.message).toMatch(/if the account is eligible/i);
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('rejects empty or missing OTP with 400', async () => {
      const res = await request(app).post('/api/auth/verify-otp').send({ institutionId: 'S-PROV' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid OTP format (not 6 digits) with 400', async () => {
      const res = await request(app).post('/api/auth/verify-otp').send({ institutionId: 'S-PROV', otp: 'abc' });
      expect(res.status).toBe(400);
    });

    it('rejects wrong OTP with 400 and increments attempts', async () => {
      const otpHash = await bcrypt.hash('123456', 10);
      await db.insert(otpSessions).values({
        institutionId: 'S-PROV',
        otpHash,
        expiresAt: Date.now() + 600000,
        attempts: 1,
      });

      const res = await request(app).post('/api/auth/verify-otp').send({ institutionId: 'S-PROV', otp: '999999' });
      expect(res.status).toBe(400);

      const session = await db.select().from(otpSessions).where(eq(otpSessions.institutionId, 'S-PROV')).get();
      expect(session?.attempts).toBe(2);
    });

    it('rejects expired OTP and removes stale session with 400', async () => {
      const otpHash = await bcrypt.hash('123456', 10);
      await db.insert(otpSessions).values({
        institutionId: 'S-PROV',
        otpHash,
        expiresAt: Date.now() - 5000,
        attempts: 0,
      });

      const res = await request(app).post('/api/auth/verify-otp').send({ institutionId: 'S-PROV', otp: '123456' });
      expect(res.status).toBe(400);

      const session = await db.select().from(otpSessions).where(eq(otpSessions.institutionId, 'S-PROV')).get();
      expect(session).toBeUndefined();
    });

    it('rejects attempts exceeding max attempt limit and destroys session with 429', async () => {
      const otpHash = await bcrypt.hash('123456', 10);
      await db.insert(otpSessions).values({
        institutionId: 'S-PROV',
        otpHash,
        expiresAt: Date.now() + 600000,
        attempts: 5,
      });

      const res = await request(app).post('/api/auth/verify-otp').send({ institutionId: 'S-PROV', otp: '123456' });
      expect(res.status).toBe(429);

      const session = await db.select().from(otpSessions).where(eq(otpSessions.institutionId, 'S-PROV')).get();
      expect(session).toBeUndefined();
    });
  });

  describe('POST /api/auth/set-password', () => {
    it('rejects passwords shorter than 12 characters with 400', async () => {
      const res = await request(app).post('/api/auth/set-password').send({
        institutionId: 'S-PROV',
        activationGrant: 'grant-sample-token',
        password: 'short',
      });
      expect(res.status).toBe(400);
    });

    it('rejects password set on already active account with 409', async () => {
      const res = await request(app).post('/api/auth/set-password').send({
        institutionId: 'S-ACTIVE',
        activationGrant: 'grant-sample-token',
        password: 'LongEnoughPassword123!',
      });
      expect(res.status).toBe(409);
    });

    it('rejects invalid or expired activation grant with 401', async () => {
      const res = await request(app).post('/api/auth/set-password').send({
        institutionId: 'S-PROV',
        activationGrant: 'nonexistent-grant-token',
        password: 'LongEnoughPassword123!',
      });
      expect(res.status).toBe(401);
    });

    it('rejects already used activation grant with 401', async () => {
      const rawGrant = 'used-grant-token';
      await db.insert(activationGrants).values({
        id: 'grant-used-id',
        userId: 'provisioned-student-user',
        tokenHash: hashOpaqueToken(rawGrant),
        expiresAt: Date.now() + 600000,
        usedAt: Date.now() - 1000,
      });

      const res = await request(app).post('/api/auth/set-password').send({
        institutionId: 'S-PROV',
        activationGrant: rawGrant,
        password: 'LongEnoughPassword123!',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects missing credentials with 400', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });

    it('rejects unknown user with 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        institutionId: 'UNKNOWN-USER',
        password: 'Password123456!',
      });
      expect(res.status).toBe(401);
    });

    it('rejects login for PRE_PROVISIONED (not yet activated) account with 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        institutionId: 'S-PROV',
        password: 'AnyPassword123!',
      });
      expect(res.status).toBe(401);
    });

    it('rejects wrong password with 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        institutionId: 'S-ACTIVE',
        password: 'WrongPassword123!',
      });
      expect(res.status).toBe(401);
    });

    it('ignores mass assignment payload attempting role elevation', async () => {
      const res = await request(app).post('/api/auth/login').send({
        institutionId: 'S-ACTIVE',
        password: 'CorrectPassword123!',
        role: 'ADMIN',
        accountStatus: 'ADMIN',
      });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('STUDENT');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rejects missing refresh token with 400', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
    });

    it('rejects invalid or unknown refresh token with 401', async () => {
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'unknown-token-123' });
      expect(res.status).toBe(401);
    });

    it('rejects expired refresh session with 401', async () => {
      const rawToken = 'expired-refresh-token';
      await db.insert(authSessions).values({
        id: 'sess-expired',
        userId: 'active-student-user',
        refreshTokenHash: hashOpaqueToken(rawToken),
        expiresAt: Date.now() - 1000,
        familyId: 'family-exp',
      });

      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: rawToken });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('succeeds with 204 on empty body without crashing', async () => {
      const res = await request(app).post('/api/auth/logout').send({});
      expect(res.status).toBe(204);
    });

    it('revokes an active refresh token session on logout', async () => {
      const rawToken = 'logout-refresh-token';
      await db.insert(authSessions).values({
        id: 'sess-logout',
        userId: 'active-student-user',
        refreshTokenHash: hashOpaqueToken(rawToken),
        expiresAt: Date.now() + 600000,
        familyId: 'family-logout',
      });

      const res = await request(app).post('/api/auth/logout').send({ refreshToken: rawToken });
      expect(res.status).toBe(204);

      const session = await db.select().from(authSessions).where(eq(authSessions.id, 'sess-logout')).get();
      expect(session?.revokedAt).toBeDefined();
    });
  });
});

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
import { createAccessToken, hashOpaqueToken } from '../src/services/tokenService';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

describe('Data Integrity, Mass Assignment, Pagination, and Security Auditing', () => {
  const app = createApp();

  const adminToken = createAccessToken({ sub: 'admin-sec-user', role: 'ADMIN', institutionId: 'INST-SEC' });
  const teacherToken = createAccessToken({ sub: 'teacher-sec-user', role: 'TEACHER', institutionId: 'INST-SEC' });

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
      id: 'INST-SEC',
      code: 'INST_SEC',
      name: 'Security Integrity College',
    });

    await db.insert(users).values([
      { id: 'admin-sec-user', role: 'ADMIN', institutionId: 'A-SEC', contactEmail: 'admin@sec.edu', accountStatus: 'ACTIVE' },
      { id: 'teacher-sec-user', role: 'TEACHER', institutionId: 'T-SEC', contactEmail: 'teacher@sec.edu', accountStatus: 'ACTIVE' },
      { id: 'student-sec-user', role: 'STUDENT', institutionId: 'S-SEC', contactEmail: 'student@sec.edu', accountStatus: 'PRE_PROVISIONED' },
    ]);

    await db.insert(teachers).values({
      id: 'prof-teacher-sec',
      userId: 'teacher-sec-user',
      employeeId: 'T-SEC',
      fullName: 'Prof. Sec',
      contactEmail: 'teacher@sec.edu',
    });

    await db.insert(students).values({
      id: 'prof-student-sec',
      userId: 'student-sec-user',
      studentId: 'S-SEC',
      fullName: 'Student Sec',
      contactEmail: 'student@sec.edu',
    });
  });

  describe('Mass assignment protection', () => {
    it('ignores client-supplied role, institutionId, and createdByUserId on announcement creation', async () => {
      const res = await request(app)
        .post('/api/academic/announcements')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Mass Assignment Test Notice',
          body: 'Testing field stripping.',
          role: 'ADMIN',
          institutionId: 'HACKED-INST-ID',
          createdByUserId: 'HACKED-USER-ID',
        });

      expect(res.status).toBe(201);
      const createdId = res.body.id;

      // Verify the announcement was created with authenticated caller context, NOT attacker payload
      const row = await db.select().from(announcements).where(eq(announcements.id, createdId)).get();
      expect(row).toBeDefined();
      expect(row?.institutionId).toBe('INST-SEC');
      expect(row?.createdByUserId).toBe('teacher-sec-user');
    });

    it('ignores client-supplied role parameter during set-password', async () => {
      // Create an activation grant for student
      const grantToken = 'valid-grant-token-12345';
      await db.insert(activationGrants).values({
        id: randomUUID(),
        userId: 'student-sec-user',
        tokenHash: hashOpaqueToken(grantToken),
        expiresAt: Date.now() + 600000,
      });

      const res = await request(app)
        .post('/api/auth/set-password')
        .send({
          institutionId: 'S-SEC',
          activationGrant: grantToken,
          password: 'NewStrongPassword123!',
          role: 'ADMIN', // Attacker attempts privilege escalation
          accountStatus: 'SUPERUSER',
        });

      expect([200, 204]).toContain(res.status);

      // Verify user in DB still has role STUDENT
      const studentUser = await db.select().from(users).where(eq(users.id, 'student-sec-user')).get();
      expect(studentUser?.role).toBe('STUDENT');
      expect(studentUser?.accountStatus).toBe('ACTIVE');
    });
  });

  describe('Pagination boundaries on list endpoints', () => {
    it('rejects invalid or out-of-bounds limit parameters on GET /announcements', async () => {
      // Negative limit
      const negRes = await request(app)
        .get('/api/academic/announcements?limit=-5')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(negRes.status).toBe(400);
      expect(negRes.body.error).toMatch(/limit/i);

      // Exceeds max 100
      const excessRes = await request(app)
        .get('/api/academic/announcements?limit=500')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(excessRes.status).toBe(400);
      expect(excessRes.body.error).toMatch(/cannot exceed 100/i);
    });

    it('respects valid pagination limit on GET /announcements', async () => {
      // Insert 5 announcements
      for (let i = 1; i <= 5; i++) {
        await db.insert(announcements).values({
          id: `ann-p-${i}`,
          institutionId: 'INST-SEC',
          title: `Announcement ${i}`,
          body: `Content ${i}`,
          publishedAt: new Date(Date.now() + i * 1000).toISOString(),
          isPublished: true,
          createdByUserId: 'teacher-sec-user',
        });
      }

      const res = await request(app)
        .get('/api/academic/announcements?limit=2')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.announcements).toHaveLength(2);
    });

    it('rejects out-of-bounds limit parameters on GET /timetable', async () => {
      const excessRes = await request(app)
        .get('/api/academic/timetable?limit=1000')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(excessRes.status).toBe(400);
      expect(excessRes.body.error).toMatch(/cannot exceed 100/i);
    });
  });

  describe('Concurrent refresh-token replay and session family revocation', () => {
    it('rotates refresh token and revokes entire family upon replay of old token', async () => {
      const familyId = randomUUID();
      const initialToken = 'refresh-token-gen-1';

      await db.insert(authSessions).values({
        id: randomUUID(),
        userId: 'admin-sec-user',
        familyId,
        refreshTokenHash: hashOpaqueToken(initialToken),
        expiresAt: Date.now() + 86400000,
      });

      // Step 1: Legitimate client exchanges initial token for gen 2
      const firstExchange = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: initialToken });

      expect(firstExchange.status).toBe(200);
      const gen2Token = firstExchange.body.refreshToken;
      expect(gen2Token).not.toBe(initialToken);

      // Step 2: Attacker replays initial token (now revoked)
      const replayAttempt = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: initialToken });

      expect(replayAttempt.status).toBe(401);
      expect(replayAttempt.body.error).toMatch(/revoked|invalid|expired/i);

      // Step 3: Legitimate client attempts to use gen2 token -> MUST FAIL because family was revoked
      const legitAttemptWithGen2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: gen2Token });

      expect(legitAttemptWithGen2.status).toBe(401);
      expect(legitAttemptWithGen2.body.error).toMatch(/revoked|invalid|expired/i);
    });
  });

  describe('Security log redaction', () => {
    it('never logs raw passwords, tokens, OTPs, or auth request bodies', async () => {
      const capturedLogs: string[] = [];
      const origStdoutWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk: any) => {
        capturedLogs.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      };

      try {
        const sensitiveSecretPassword = 'TopSecretPassword999!';
        const sensitiveOtpCode = '987654';

        await request(app)
          .post('/api/auth/login')
          .send({ institutionId: 'S-SEC', password: sensitiveSecretPassword });

        await request(app)
          .post('/api/auth/verify-otp')
          .send({ institutionId: 'S-SEC', otp: sensitiveOtpCode });

        const fullLogOutput = capturedLogs.join('\n');
        expect(fullLogOutput).not.toContain(sensitiveSecretPassword);
        expect(fullLogOutput).not.toContain(sensitiveOtpCode);
      } finally {
        process.stdout.write = origStdoutWrite;
      }
    });
  });

  describe('Security event audit-log writes', () => {
    it('records audit log entries on key lifecycle and security actions', async () => {
      // 1. Request activation writes audit log
      await request(app)
        .post('/api/auth/request-activation')
        .send({ institutionId: 'S-SEC' });

      // 2. Teacher creates announcement writes audit log
      await request(app)
        .post('/api/academic/announcements')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Audited Announcement',
          body: 'Verifying audit trail.',
        });

      const logs = await db.select().from(auditLogs);
      const actions = logs.map((l) => l.action);

      expect(actions).toContain('ACTIVATION_REQUESTED');
      expect(actions).toContain('ANNOUNCEMENT_CREATED');
    });
  });

  describe('Admin import commit transaction rollback', () => {
    it('rolls back all records in transaction when any row violates a constraint', async () => {
      // Pre-insert an institution so that row 2 in the import will hit a duplicate code conflict
      await db.insert(institutions).values({
        id: 'inst-pre-existing',
        code: 'CONFLICT-CODE',
        name: 'Pre-existing Conflict',
      });

      const previewRes = await request(app)
        .post('/api/admin/imports/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entity: 'institutions',
          rows: [
            { code: 'NEW-ROW-1', name: 'Fresh College 1' },
            { code: 'CONFLICT-CODE', name: 'Duplicate College 2' },
          ],
        });

      // Preview identifies that row 2 has a conflict (or even if committed directly)
      const jobId = previewRes.body.importJobId;

      // Attempt commit
      const commitRes = await request(app)
        .post(`/api/admin/imports/${jobId}/commit`)
        .set('Authorization', `Bearer ${adminToken}`);

      // If preview had invalidRows > 0, commit returns 422, or if attempted, 409
      expect([409, 422]).toContain(commitRes.status);

      // CRITICAL ASSERTION: NEW-ROW-1 was NOT committed to the database!
      const row1InDb = await db.select().from(institutions).where(eq(institutions.code, 'NEW-ROW-1')).get();
      expect(row1InDb).toBeUndefined();
    });
  });
});

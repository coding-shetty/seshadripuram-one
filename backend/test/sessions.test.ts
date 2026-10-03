import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { db } from '../src/db';
import {
  activationGrants,
  announcements,
  attendanceRecords,
  authSessions,
  enrollments,
  importJobs,
  students,
  teachers,
  teachingAssignments,
  timetableEntries,
  users,
} from '../src/db/schema';
import { createApp } from '../src';
import { cleanupExpiredSessions } from '../src/services/sessionCleanup';

describe('session rotation reuse detection and cleanup', () => {
  const app = createApp();

  beforeEach(async () => {
    await db.delete(authSessions);
    await db.delete(activationGrants);
    await db.delete(importJobs);
    await db.delete(announcements);
    await db.delete(timetableEntries);
    await db.delete(teachingAssignments);
    await db.delete(attendanceRecords);
    await db.delete(enrollments);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);
  });

  it('detects refresh token replay, returns 401, and revokes the entire session family', async () => {
    const userId = randomUUID();
    const studentId = 'STU-REPLAY-1';
    const password = 'StrongPassword123!';
    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(users).values({
      id: userId,
      role: 'STUDENT',
      institutionId: studentId,
      contactEmail: 'replay@college.edu',
      passwordHash,
      accountStatus: 'ACTIVE',
      isActive: true,
    });

    await db.insert(students).values({
      id: randomUUID(),
      userId,
      studentId,
      fullName: 'Replay Test Student',
      contactEmail: 'replay@college.edu',
      isActive: true,
    });

    // 1. Initial Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ institutionId: studentId, password });

    expect(loginRes.status).toBe(200);
    const token1 = loginRes.body.refreshToken as string;
    expect(token1).toBeDefined();

    // 2. Legitimate refresh: rotates token1 -> token2
    const refreshRes1 = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: token1 });

    expect(refreshRes1.status).toBe(200);
    const token2 = refreshRes1.body.refreshToken as string;
    expect(token2).toBeDefined();
    expect(token2).not.toBe(token1);

    // 3. Replay attack: Attacker attempts to reuse token1
    const replayRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: token1 });

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error || replayRes.body.message).toMatch(/reuse|invalid/i);

    // 4. Verification: Family revocation -> token2 MUST now also be rejected
    const refreshRes2 = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: token2 });

    expect(refreshRes2.status).toBe(401);
  });

  it('cleans up expired sessions from the database', async () => {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      role: 'STUDENT',
      institutionId: 'STU-CLEANUP',
      contactEmail: 'cleanup@college.edu',
      accountStatus: 'ACTIVE',
    });

    const now = Date.now();
    // Expired session
    await db.insert(authSessions).values({
      id: randomUUID(),
      userId,
      refreshTokenHash: 'hash-expired',
      expiresAt: now - 10000,
    });

    // Active session
    await db.insert(authSessions).values({
      id: randomUUID(),
      userId,
      refreshTokenHash: 'hash-active',
      expiresAt: now + 60000,
    });

    const result = await cleanupExpiredSessions();
    expect(result.deletedSessions).toBeGreaterThanOrEqual(1);

    const remaining = await db.select().from(authSessions);
    expect(remaining.some((s) => s.refreshTokenHash === 'hash-expired')).toBe(false);
    expect(remaining.some((s) => s.refreshTokenHash === 'hash-active')).toBe(true);
  });
});

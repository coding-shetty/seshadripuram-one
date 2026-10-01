import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { db } from '../src/db';
import {
  users,
  students,
  teachers,
  auditLogs,
  authSessions,
  activationGrants,
  otpSessions,
  announcements,
  importJobs,
  institutions,
} from '../src/db/schema';
import { createApp } from '../src';
import { eq, desc } from 'drizzle-orm';
import { cleanupImportPayloads } from '../src/services/importRetention';
import { createAccessToken } from '../src/services/tokenService';

describe('Security audit logging', () => {
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
      id: 'inst-audit',
      code: 'INST_AUDIT',
      name: 'Audit College',
    });

    await db.insert(users).values([
      {
        id: 'teacher-audit-user',
        role: 'TEACHER',
        institutionId: 'T-AUDIT',
        contactEmail: 'teacher@audit.edu',
        accountStatus: 'ACTIVE',
        passwordHash: await bcrypt.hash('teacher-pass-123', 10),
      },
      {
        id: 'student-audit-user',
        role: 'STUDENT',
        institutionId: 'S-AUDIT',
        contactEmail: 'student@audit.edu',
        accountStatus: 'PRE_PROVISIONED',
      },
    ]);

    await db.insert(teachers).values({
      id: 'teacher-prof',
      userId: 'teacher-audit-user',
      employeeId: 'T-AUDIT',
      fullName: 'Teacher Audit',
      contactEmail: 'teacher@audit.edu',
    });

    await db.insert(students).values({
      id: 'student-prof',
      userId: 'student-audit-user',
      studentId: 'S-AUDIT',
      fullName: 'Student Audit',
      contactEmail: 'student@audit.edu',
    });
  });

  it('records an audit entry on login failure with no password or token PII', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ institutionId: 'T-AUDIT', password: 'wrong-password-here' });

    expect(res.status).toBe(401);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'LOGIN_FAILED')).all();
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const log = logs[0];
    expect(log).toBeDefined();
    expect(log!.details).not.toContain('wrong-password-here');
    expect(log!.details).not.toContain('teacher@audit.edu');
    expect(log!.details).toMatch(/reason|invalid_credentials|failed/i);
  });

  it('records an audit entry when activation is requested', async () => {
    const res = await request(app)
      .post('/api/auth/request-activation')
      .send({ institutionId: 'S-AUDIT' });

    expect(res.status).toBe(202);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'ACTIVATION_REQUESTED')).all();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]?.details).not.toContain('student@audit.edu');
  });

  it('records an audit entry on role-sensitive writes (creating announcement)', async () => {
    const teacherToken = createAccessToken({
      sub: 'teacher-audit-user',
      role: 'TEACHER',
      institutionId: 'inst-audit',
    });

    const res = await request(app)
      .post('/api/academic/announcements')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Exam Notice',
        body: 'Exams begin next week for all students.',
        category: 'ACADEMIC',
      });

    expect(res.status).toBe(201);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'ANNOUNCEMENT_CREATED')).all();
    expect(logs.length).toBe(1);
    expect(logs[0]?.details).toContain('teacher-audit-user');
    expect(logs[0]?.details).not.toContain('teacher@audit.edu');
  });

  it('records an audit entry when import payloads are purged', async () => {
    await db.insert(importJobs).values({
      id: 'job-to-purge',
      actorUserId: 'teacher-audit-user',
      entity: 'institutions',
      status: 'COMMITTED',
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      errorsJson: '[]',
      payloadJson: JSON.stringify([{ code: 'X', name: 'Y' }]),
    });

    const result = await cleanupImportPayloads(db, { retentionDays: 0 });
    expect(result.purgedCount).toBe(1);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'IMPORT_PAYLOAD_PURGED')).all();
    expect(logs.length).toBe(1);
    expect(logs[0]?.details).toContain('job-to-purge');
  });
});

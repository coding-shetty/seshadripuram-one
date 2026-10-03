import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../src/db';
import {
  academicYears,
  auditLogs,
  departments,
  importJobs,
  institutions,
  programs,
  sections,
  semesters,
  students,
  teachers,
  users,
} from '../src/db/schema';
import { createApp } from '../src';
import { createAccessToken } from '../src/services/tokenService';
import { assertSafeCleanup } from './helpers/cleanDb';

describe('Admin Stats, Audit Logs, and Structure API', () => {
  const app = createApp();

  const instId = 'inst-admin-test';
  let adminUserId: string;
  let studentUserId: string;
  let adminToken: string;
  let studentToken: string;

  beforeEach(async () => {
    assertSafeCleanup();
    await db.delete(auditLogs);
    await db.delete(importJobs);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);
    await db.delete(sections);
    await db.delete(semesters);
    await db.delete(programs);
    await db.delete(departments);
    await db.delete(academicYears);
    await db.delete(institutions);

    // Seed institution
    await db.insert(institutions).values({
      id: instId,
      code: 'SESH-ADMIN-TEST',
      name: 'Seshadripuram College Admin Test',
    });

    // Seed Admin user
    adminUserId = randomUUID();
    await db.insert(users).values({
      id: adminUserId,
      institutionId: 'SESH-ADM-001',
      role: 'ADMIN',
      collegeId: instId,
      contactEmail: 'admin@seshadripuram.edu',
      accountStatus: 'ACTIVE',
      isActive: true,
    });
    adminToken = createAccessToken({
      sub: adminUserId,
      role: 'ADMIN',
      institutionId: instId,
    });

    // Seed Student user (for RBAC test)
    studentUserId = randomUUID();
    await db.insert(users).values({
      id: studentUserId,
      institutionId: 'SESH-STU-999',
      role: 'STUDENT',
      contactEmail: 'student@seshadripuram.edu',
      accountStatus: 'ACTIVE',
      isActive: true,
    });
    studentToken = createAccessToken({
      sub: studentUserId,
      role: 'STUDENT',
      institutionId: instId,
    });
  });

  it('rejects non-admin callers with 403 Forbidden', async () => {
    const statsRes = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(statsRes.status).toBe(403);

    const logsRes = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(logsRes.status).toBe(403);

    const structRes = await request(app)
      .get('/api/admin/structure')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(structRes.status).toBe(403);
  });

  it('returns accurate real statistics from database', async () => {
    await db.insert(users).values([
      { id: 'stats-s1', institutionId: 'stats-s1', role: 'STUDENT', collegeId: instId },
      { id: 'stats-s2', institutionId: 'stats-s2', role: 'STUDENT', collegeId: instId },
      { id: 'stats-t1', institutionId: 'stats-t1', role: 'TEACHER', collegeId: instId },
    ]);
    // Insert 2 active students, 1 inactive student
    await db.insert(students).values([
      { id: randomUUID(), studentId: 'STU-1', userId: 'stats-s1', fullName: 'Student 1', contactEmail: 's1@test.com', isActive: true },
      { id: randomUUID(), studentId: 'STU-2', userId: 'stats-s2', fullName: 'Student 2', contactEmail: 's2@test.com', isActive: true },
      { id: randomUUID(), studentId: 'STU-3', fullName: 'Student 3', contactEmail: 's3@test.com', isActive: false },
    ]);

    // Insert 1 active teacher
    await db.insert(teachers).values([
      { id: randomUUID(), employeeId: 'EMP-1', userId: 'stats-t1', fullName: 'Prof. Smith', contactEmail: 'prof@test.com', isActive: true },
    ]);

    // Insert 1 PREVIEWED import job, 1 COMMITTED import job
    await db.insert(importJobs).values([
      { id: 'job-1', actorUserId: adminUserId, collegeId: instId, entity: 'students', status: 'PREVIEWED', totalRows: 5, validRows: 5, invalidRows: 0, errorsJson: '[]' },
      { id: 'job-2', actorUserId: adminUserId, collegeId: instId, entity: 'students', status: 'COMMITTED', totalRows: 10, validRows: 10, invalidRows: 0, errorsJson: '[]' },
    ]);

    // Insert 1 active section
    const deptId = randomUUID();
    await db.insert(departments).values({ id: deptId, institutionId: instId, code: 'CS', name: 'Computer Science' });
    const progId = randomUUID();
    await db.insert(programs).values({ id: progId, departmentId: deptId, code: 'BCA', name: 'BCA', level: 'UG', durationSemesters: 6 });
    const yearId = randomUUID();
    await db.insert(academicYears).values({ id: yearId, institutionId: instId, label: '2026-27', startDate: '2026-06-01', endDate: '2027-05-31' });
    const semId = randomUUID();
    await db.insert(semesters).values({ id: semId, academicYearId: yearId, number: 1, label: 'Sem 1' });
    await db.insert(sections).values({ id: randomUUID(), programId: progId, academicYearId: yearId, semesterId: semId, name: 'BCA 1A', isActive: true });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      activeStudents: 2,
      facultyMembers: 1,
      pendingImports: 1,
      activeSections: 1,
    });
  });

  it('returns real audit logs in reverse chronological order', async () => {
    await db.insert(auditLogs).values([
      { id: 'log-1', collegeId: instId, action: 'USER_LOGIN', details: 'User admin logged in', timestamp: '2026-10-04 10:00:00' },
      { id: 'log-2', collegeId: instId, action: 'ATTENDANCE_MARKED', details: 'Section BCA 1A period 1 marked', timestamp: '2026-10-04 10:15:00' },
    ]);

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(2);
    expect(res.body.logs[0].id).toBe('log-2');
    expect(res.body.logs[1].id).toBe('log-1');
  });

  it('returns academic structure for institution', async () => {
    const deptId = randomUUID();
    await db.insert(departments).values({ id: deptId, institutionId: instId, code: 'COMMERCE', name: 'Commerce Dept' });

    const res = await request(app)
      .get('/api/admin/structure')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.departments).toHaveLength(1);
    expect(res.body.departments[0].code).toBe('COMMERCE');
  });
  it('does not return another college statistics, logs, programs or sections', async () => {
    await db.insert(institutions).values({ id: 'other-college', code: 'OTHER', name: 'Other college' });
    await db.insert(users).values({ id: 'other-user', role: 'STUDENT', institutionId: 'OTHER-1', collegeId: 'other-college' });
    await db.insert(students).values({ id: 'other-student', studentId: 'OTHER-1', userId: 'other-user', fullName: 'Private name', contactEmail: 'private@example.test' });
    await db.insert(auditLogs).values({ id: 'other-log', action: 'PRIVATE', collegeId: 'other-college', details: 'Private detail' });
    await db.insert(departments).values({ id: 'other-dept', institutionId: 'other-college', code: 'OTHER', name: 'Other department' });
    await db.insert(programs).values({ id: 'other-program', departmentId: 'other-dept', code: 'OTHER', name: 'Other program', level: 'UG', durationSemesters: 6 });
    const stats = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);
    const logs = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${adminToken}`);
    const structure = await request(app).get('/api/admin/structure').set('Authorization', `Bearer ${adminToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.stats.activeStudents).toBe(0);
    expect(logs.status).toBe(200);
    expect(logs.body.logs).toEqual([]);
    expect(structure.status).toBe(200);
    expect(structure.body).toEqual({ departments: [], programs: [], sections: [] });
  });

  it('fails closed when an admin has no explicit college membership', async () => {
    await db.update(users).set({ collegeId: null }).where(eq(users.id, adminUserId));
    for (const path of ['stats', 'audit-logs', 'structure']) {
      const res = await request(app).get(`/api/admin/${path}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    }
  });

});

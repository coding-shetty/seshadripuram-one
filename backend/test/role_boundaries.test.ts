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
import { createAccessToken } from '../src/services/tokenService';

describe('Role boundaries & authorization matrix across all protected endpoints', () => {
  const app = createApp();

  const studentToken = createAccessToken({ sub: 'user-stu', role: 'STUDENT', institutionId: 'INST-ROLE' });
  const teacherToken = createAccessToken({ sub: 'user-tea', role: 'TEACHER', institutionId: 'INST-ROLE' });
  const adminToken = createAccessToken({ sub: 'user-adm', role: 'ADMIN', institutionId: 'INST-ROLE' });

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
      id: 'INST-ROLE',
      code: 'INST_ROLE_CODE',
      name: 'Role Test College',
    });

    await db.insert(users).values([
      { id: 'user-stu', role: 'STUDENT', institutionId: 'S-ROLE', contactEmail: 'stu@role.edu', accountStatus: 'ACTIVE' },
      { id: 'user-tea', role: 'TEACHER', institutionId: 'T-ROLE', contactEmail: 'tea@role.edu', accountStatus: 'ACTIVE' },
      { id: 'user-adm', role: 'ADMIN', institutionId: 'A-ROLE', contactEmail: 'adm@role.edu', accountStatus: 'ACTIVE' },
    ]);

    await db.insert(students).values({
      id: 'prof-stu',
      userId: 'user-stu',
      studentId: 'S-ROLE',
      fullName: 'Student Role',
      contactEmail: 'stu@role.edu',
    });

    await db.insert(teachers).values({
      id: 'prof-tea',
      userId: 'user-tea',
      employeeId: 'T-ROLE',
      fullName: 'Teacher Role',
      contactEmail: 'tea@role.edu',
    });
  });

  describe('Unauthenticated callers (Anonymous) must be rejected with 401 across all protected routes', () => {
    it('rejects GET /api/auth/me', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects GET /api/academic/timetable', async () => {
      const res = await request(app).get('/api/academic/timetable');
      expect(res.status).toBe(401);
    });

    it('rejects GET /api/academic/announcements', async () => {
      const res = await request(app).get('/api/academic/announcements');
      expect(res.status).toBe(401);
    });

    it('rejects POST /api/academic/announcements', async () => {
      const res = await request(app).post('/api/academic/announcements').send({ title: 'T', body: 'B' });
      expect(res.status).toBe(401);
    });

    it('rejects POST /api/academic/attendance', async () => {
      const res = await request(app).post('/api/academic/attendance').send({});
      expect(res.status).toBe(401);
    });

    it('rejects POST /api/admin/imports/preview', async () => {
      const res = await request(app).post('/api/admin/imports/preview').send({ entity: 'institutions', rows: [] });
      expect(res.status).toBe(401);
    });

    it('rejects POST /api/admin/imports/job-1/commit', async () => {
      const res = await request(app).post('/api/admin/imports/job-1/commit');
      expect(res.status).toBe(401);
    });

    it('rejects GET /api/admin/imports/job-1', async () => {
      const res = await request(app).get('/api/admin/imports/job-1');
      expect(res.status).toBe(401);
    });
  });

  describe('STUDENT role boundaries', () => {
    it('allows GET /api/auth/me and GET /api/academic/*', async () => {
      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${studentToken}`);
      expect(me.status).toBe(200);

      const tt = await request(app).get('/api/academic/timetable').set('Authorization', `Bearer ${studentToken}`);
      expect(tt.status).toBe(200);

      const ann = await request(app).get('/api/academic/announcements').set('Authorization', `Bearer ${studentToken}`);
      expect(ann.status).toBe(200);
    });

    it('forbids POST /api/academic/announcements with 403', async () => {
      const res = await request(app)
        .post('/api/academic/announcements')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Student Post', body: 'Should fail' });
      expect(res.status).toBe(403);
    });

    it('forbids POST /api/academic/attendance with 403', async () => {
      const res = await request(app).post('/api/academic/attendance').set('Authorization', `Bearer ${studentToken}`).send({});
      expect(res.status).toBe(403);
    });

    it('forbids all /api/admin/imports routes with 403', async () => {
      const preview = await request(app)
        .post('/api/admin/imports/preview')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ entity: 'institutions', rows: [] });
      expect(preview.status).toBe(403);

      const commit = await request(app)
        .post('/api/admin/imports/job-1/commit')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(commit.status).toBe(403);

      const getJob = await request(app)
        .get('/api/admin/imports/job-1')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(getJob.status).toBe(403);
    });
  });

  describe('TEACHER role boundaries', () => {
    it('allows academic write routes (announcements 201, attendance 501 stub)', async () => {
      const ann = await request(app)
        .post('/api/academic/announcements')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Class Announcement', body: 'Welcome class.', category: 'GENERAL' });
      expect(ann.status).toBe(201);

      const att = await request(app).post('/api/academic/attendance').set('Authorization', `Bearer ${teacherToken}`).send({});
      expect(att.status).toBe(501);
    });

    it('forbids all /api/admin/imports routes with 403', async () => {
      const preview = await request(app)
        .post('/api/admin/imports/preview')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ entity: 'institutions', rows: [] });
      expect(preview.status).toBe(403);

      const commit = await request(app)
        .post('/api/admin/imports/job-1/commit')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(commit.status).toBe(403);

      const getJob = await request(app)
        .get('/api/admin/imports/job-1')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(getJob.status).toBe(403);
    });
  });

  describe('ADMIN role boundaries', () => {
    it('allows administrative import preview and inspection routes', async () => {
      const preview = await request(app)
        .post('/api/admin/imports/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entity: 'institutions',
          rows: [{ code: 'ADM-COLLEGE', name: 'Admin Created College' }],
        });
      expect(preview.status).toBe(201);
      expect(preview.body.importJobId).toBeDefined();

      const jobId = preview.body.importJobId;
      const getJob = await request(app)
        .get(`/api/admin/imports/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getJob.status).toBe(200);
      expect(getJob.body.importJobId).toBe(jobId);
    });
  });
});

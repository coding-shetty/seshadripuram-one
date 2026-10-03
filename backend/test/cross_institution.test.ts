import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
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
  departments,
  sections,
  academicYears,
  semesters,
  timetableEntries,
  subjects,
} from '../src/db/schema';
import { createApp } from '../src';
import { createAccessToken } from '../src/services/tokenService';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

describe('Cross-institution tenant isolation & IDOR prevention', () => {
  const app = createApp();

  const studentA_Token = createAccessToken({ sub: 'user-stu-a', role: 'STUDENT', institutionId: 'inst-a' });
  const studentB_Token = createAccessToken({ sub: 'user-stu-b', role: 'STUDENT', institutionId: 'inst-b' });
  const teacherA_Token = createAccessToken({ sub: 'user-tea-a', role: 'TEACHER', institutionId: 'inst-a' });
  const adminA_Token = createAccessToken({ sub: 'user-adm-a', role: 'ADMIN', institutionId: 'inst-a' });
  const adminB_Token = createAccessToken({ sub: 'user-adm-b', role: 'ADMIN', institutionId: 'inst-b' });

  beforeEach(async () => {
    await db.delete(authSessions);
    await db.delete(activationGrants);
    await db.delete(otpSessions);
    await db.delete(auditLogs);
    await db.delete(announcements);
    await db.delete(timetableEntries);
    await db.delete(subjects);
    await db.delete(importJobs);
    await db.delete(sections);
    await db.delete(departments);
    await db.delete(semesters);
    await db.delete(academicYears);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);
    await db.delete(institutions);

    await db.insert(institutions).values([
      { id: 'inst-a', code: 'INST-A', name: 'Institution Alpha' },
      { id: 'inst-b', code: 'INST-B', name: 'Institution Beta' },
    ]);

    await db.insert(users).values([
      { id: 'user-stu-a', role: 'STUDENT', institutionId: 'UID-STU-A', contactEmail: 'stu-a@alpha.edu', accountStatus: 'ACTIVE' },
      { id: 'user-stu-b', role: 'STUDENT', institutionId: 'UID-STU-B', contactEmail: 'stu-b@beta.edu', accountStatus: 'ACTIVE' },
      { id: 'user-tea-a', role: 'TEACHER', institutionId: 'UID-TEA-A', contactEmail: 'tea-a@alpha.edu', accountStatus: 'ACTIVE' },
      { id: 'user-adm-a', role: 'ADMIN', institutionId: 'UID-ADM-A', contactEmail: 'adm-a@alpha.edu', accountStatus: 'ACTIVE' },
      { id: 'user-adm-b', role: 'ADMIN', institutionId: 'UID-ADM-B', contactEmail: 'adm-b@beta.edu', accountStatus: 'ACTIVE' },
    ]);

    await db.insert(students).values([
      { id: 'prof-stu-a', userId: 'user-stu-a', studentId: 'S-A-1', fullName: 'Student Alpha', contactEmail: 'stu-a@alpha.edu' },
      { id: 'prof-stu-b', userId: 'user-stu-b', studentId: 'S-B-1', fullName: 'Student Beta', contactEmail: 'stu-b@beta.edu' },
    ]);

    await db.insert(teachers).values([
      { id: 'prof-tea-a', userId: 'user-tea-a', employeeId: 'T-A-1', fullName: 'Teacher Alpha', contactEmail: 'tea-a@alpha.edu' },
    ]);

    // Create Announcements for College A and College B
    await db.insert(announcements).values([
      {
        id: 'ann-a-1',
        institutionId: 'inst-a',
        title: 'Alpha Only Notice',
        body: 'Confidential to College Alpha.',
        publishedAt: new Date().toISOString(),
        isPublished: true,
        createdByUserId: 'user-adm-a',
      },
      {
        id: 'ann-b-1',
        institutionId: 'inst-b',
        title: 'Beta Only Notice',
        body: 'Confidential to College Beta.',
        publishedAt: new Date().toISOString(),
        isPublished: true,
        createdByUserId: 'user-adm-b',
      },
    ]);
  });

  describe('Tenant isolation on announcements', () => {
    it('prevents Student A from seeing College Beta announcements', async () => {
      const res = await request(app)
        .get('/api/academic/announcements')
        .set('Authorization', `Bearer ${studentA_Token}`);

      expect(res.status).toBe(200);
      const titles = res.body.announcements.map((a: any) => a.title);
      expect(titles).toContain('Alpha Only Notice');
      expect(titles).not.toContain('Beta Only Notice');
    });

    it('prevents Teacher A from posting to a section belonging to College Beta', async () => {
      const res = await request(app)
        .post('/api/academic/announcements')
        .set('Authorization', `Bearer ${teacherA_Token}`)
        .send({
          title: 'Cross-Tenant Post',
          body: 'Trying to post to Beta.',
          sectionId: 'sec-b',
        });

      // Teacher A does not belong to section sec-b in College B
      expect(res.status).toBe(403);
    });
  });

  describe('IDOR prevention on admin import jobs', () => {
    it('prevents Admin B from viewing or committing Admin A import preview (returns 404)', async () => {
      const previewA = await request(app)
        .post('/api/admin/imports/preview')
        .set('Authorization', `Bearer ${adminA_Token}`)
        .send({
          entity: 'institutions',
          rows: [{ code: 'NEW-A', name: 'New Alpha Unit' }],
        });

      expect(previewA.status).toBe(201);
      const jobId = previewA.body.importJobId;

      // Admin B attempts to inspect Admin A's staged preview
      const getByB = await request(app)
        .get(`/api/admin/imports/${jobId}`)
        .set('Authorization', `Bearer ${adminB_Token}`);

      expect(getByB.status).toBe(404);
      expect(getByB.body.error).toMatch(/not found/i);

      // Admin B attempts to commit Admin A's staged preview
      const commitByB = await request(app)
        .post(`/api/admin/imports/${jobId}/commit`)
        .set('Authorization', `Bearer ${adminB_Token}`);

      expect(commitByB.status).toBe(404);
      expect(commitByB.body.error).toMatch(/not found/i);

      // Verify the job was NOT committed by Admin B and remains PREVIEWED for Admin A
      const jobInDb = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).get();
      expect(jobInDb?.status).toBe('PREVIEWED');
    });

    it('prevents a different Admin within the same institution from accessing or committing another admins import job', async () => {
      const adminA2_Token = createAccessToken({ sub: 'user-adm-a2', role: 'ADMIN', institutionId: 'inst-a' });
      await db.insert(users).values({
        id: 'user-adm-a2',
        role: 'ADMIN',
        institutionId: 'UID-ADM-A2',
        contactEmail: 'adm-a2@alpha.edu',
        accountStatus: 'ACTIVE',
      });

      const previewA = await request(app)
        .post('/api/admin/imports/preview')
        .set('Authorization', `Bearer ${adminA_Token}`)
        .send({
          entity: 'institutions',
          rows: [{ code: 'NEW-A2', name: 'Alpha Sub-Branch' }],
        });

      expect(previewA.status).toBe(201);
      const jobId = previewA.body.importJobId;

      // Admin A2 in SAME institution attempts to access Admin A1's job
      const getByA2 = await request(app)
        .get(`/api/admin/imports/${jobId}`)
        .set('Authorization', `Bearer ${adminA2_Token}`);

      expect(getByA2.status).toBe(404);

      // Admin A2 in SAME institution attempts to commit Admin A1's job
      const commitByA2 = await request(app)
        .post(`/api/admin/imports/${jobId}/commit`)
        .set('Authorization', `Bearer ${adminA2_Token}`);

      expect(commitByA2.status).toBe(404);
    });
  });
});

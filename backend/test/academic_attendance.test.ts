import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../src/db';
import {
  academicYears,
  attendanceRecords,
  auditLogs,
  departments,
  enrollments,
  institutions,
  programs,
  sections,
  semesters,
  students,
  subjectOfferings,
  subjects,
  teachers,
  teachingAssignments,
  users,
} from '../src/db/schema';
import { createApp } from '../src';
import { createAccessToken } from '../src/services/tokenService';
import { assertSafeCleanup } from './helpers/cleanDb';

describe('Academic Attendance Lifecycle & Real Calculations', () => {
  const app = createApp();

  const instId = 'inst-att-test';
  let secId: string;
  let subjectId: string;
  let student1UserId: string;
  let student1Id: string;
  let student2UserId: string;
  let student2Id: string;
  let teacherUserId: string;
  let teacherId: string;

  let student1Token: string;
  let teacherToken: string;

  beforeEach(async () => {
    assertSafeCleanup();
    await db.delete(attendanceRecords);
    await db.delete(teachingAssignments);
    await db.delete(enrollments);
    await db.delete(subjectOfferings);
    await db.delete(auditLogs);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);
    await db.delete(sections);
    await db.delete(semesters);
    await db.delete(subjects);
    await db.delete(programs);
    await db.delete(departments);
    await db.delete(academicYears);
    await db.delete(institutions);

    // 1. Institution, Dept, Program, Section, Subject
    await db.insert(institutions).values({
      id: instId,
      code: 'SET-ATT',
      name: 'Seshadripuram Test College',
    });

    const deptId = randomUUID();
    await db.insert(departments).values({
      id: deptId,
      institutionId: instId,
      code: 'CS',
      name: 'Computer Science',
    });

    const progId = randomUUID();
    await db.insert(programs).values({
      id: progId,
      departmentId: deptId,
      code: 'BCA',
      name: 'Bachelor of Computer Applications',
      level: 'UG',
      durationSemesters: 6,
    });

    const acadId = randomUUID();
    await db.insert(academicYears).values({
      id: acadId,
      institutionId: instId,
      label: '2026-2027',
      startDate: '2026-08-01',
      endDate: '2027-05-31',
      isCurrent: true,
    });

    const semId = randomUUID();
    await db.insert(semesters).values({
      id: semId,
      academicYearId: acadId,
      number: 1,
      label: 'Semester 1',
    });

    secId = randomUUID();
    await db.insert(sections).values({
      id: secId,
      programId: progId,
      academicYearId: acadId,
      semesterId: semId,
      name: 'Section A',
      capacity: 60,
    });

    subjectId = randomUUID();
    await db.insert(subjects).values({
      id: subjectId,
      departmentId: deptId,
      code: 'CS101',
      name: 'Data Structures',
      credits: 4,
    });

    const offeringId = randomUUID();
    await db.insert(subjectOfferings).values({
      id: offeringId,
      sectionId: secId,
      subjectId: subjectId,
      semesterId: semId,
    });

    // 2. Teacher
    teacherUserId = randomUUID();
    teacherId = randomUUID();
    await db.insert(users).values({
      id: teacherUserId,
      role: 'TEACHER',
      institutionId: 'TCH-001',
      contactEmail: 'teacher@seshadripuram.edu',
      accountStatus: 'ACTIVE',
    });
    await db.insert(teachers).values({
      id: teacherId,
      userId: teacherUserId,
      employeeId: 'TCH-001',
      fullName: 'Prof. Alan Turing',
      contactEmail: 'teacher@seshadripuram.edu',
    });
    await db.insert(teachingAssignments).values({
      id: randomUUID(),
      teacherId,
      subjectOfferingId: offeringId,
      assignmentRole: 'PRIMARY',
      isActive: true,
    });

    // 3. Students
    student1UserId = randomUUID();
    student1Id = randomUUID();
    await db.insert(users).values({
      id: student1UserId,
      role: 'STUDENT',
      institutionId: 'STU-001',
      contactEmail: 'student1@seshadripuram.edu',
      accountStatus: 'ACTIVE',
    });
    await db.insert(students).values({
      id: student1Id,
      userId: student1UserId,
      studentId: 'STU-001',
      fullName: 'Alice Walker',
      contactEmail: 'student1@seshadripuram.edu',
    });
    await db.insert(enrollments).values({
      id: randomUUID(),
      studentId: student1Id,
      sectionId: secId,
      academicYearId: acadId,
      semesterId: semId,
      status: 'ACTIVE',
    });

    student2UserId = randomUUID();
    student2Id = randomUUID();
    await db.insert(users).values({
      id: student2UserId,
      role: 'STUDENT',
      institutionId: 'STU-002',
      contactEmail: 'student2@seshadripuram.edu',
      accountStatus: 'ACTIVE',
    });
    await db.insert(students).values({
      id: student2Id,
      userId: student2UserId,
      studentId: 'STU-002',
      fullName: 'Bob Martin',
      contactEmail: 'student2@seshadripuram.edu',
    });
    await db.insert(enrollments).values({
      id: randomUUID(),
      studentId: student2Id,
      sectionId: secId,
      academicYearId: acadId,
      semesterId: semId,
      status: 'ACTIVE',
    });

    student1Token = createAccessToken({ sub: student1UserId, role: 'STUDENT', institutionId: 'STU-001' });
    teacherToken = createAccessToken({ sub: teacherUserId, role: 'TEACHER', institutionId: 'TCH-001' });
  });

  describe('1. Section Students Roster (GET /api/academic/sections/:sectionId/students)', () => {
    it('returns enrolled students roster to authorized teacher', async () => {
      const res = await request(app)
        .get(`/api/academic/sections/${secId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.section).toEqual({ id: secId, name: 'Section A' });
      expect(res.body.students).toHaveLength(2);
      expect(res.body.students[0].studentId).toBe('STU-001');
      expect(res.body.students[0].fullName).toBe('Alice Walker');
    });

    it('rejects student attempting to access section student roster', async () => {
      const res = await request(app)
        .get(`/api/academic/sections/${secId}/students`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('2. Attendance Marking (POST /api/academic/attendance)', () => {
    it('allows assigned teacher to record attendance and verifies audit log', async () => {
      const payload = {
        sectionId: secId,
        subjectId: subjectId,
        date: '2026-10-04',
        period: 1,
        records: [
          { studentId: student1Id, status: 'PRESENT' },
          { studentId: student2Id, status: 'ABSENT', remarks: 'Medical leave' },
        ],
      };

      const res = await request(app)
        .post('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('recorded');
      expect(res.body.recordedCount).toBe(2);

      // Verify DB rows
      const dbRecords = await db.select().from(attendanceRecords);
      expect(dbRecords).toHaveLength(2);
      const aliceRec = dbRecords.find((r) => r.studentId === student1Id);
      expect(aliceRec?.status).toBe('PRESENT');
      const bobRec = dbRecords.find((r) => r.studentId === student2Id);
      expect(bobRec?.status).toBe('ABSENT');
      expect(bobRec?.remarks).toBe('Medical leave');
    });

    it('upserts cleanly if attendance is submitted again for the same period and date', async () => {
      // First submission
      await request(app)
        .post('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          sectionId: secId,
          subjectId: subjectId,
          date: '2026-10-04',
          period: 1,
          records: [{ studentId: student1Id, status: 'ABSENT' }],
        });

      // Teacher corrects Alice from ABSENT to PRESENT
      const res = await request(app)
        .post('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          sectionId: secId,
          subjectId: subjectId,
          date: '2026-10-04',
          period: 1,
          records: [{ studentId: student1Id, status: 'PRESENT', remarks: 'Marked present on correction' }],
        });

      expect(res.status).toBe(201);

      // Verify only 1 record exists with updated status
      const dbRecords = await db.select().from(attendanceRecords);
      expect(dbRecords).toHaveLength(1);
      expect(dbRecords[0]?.status).toBe('PRESENT');
      expect(dbRecords[0]?.remarks).toBe('Marked present on correction');
    });

    it('rejects student trying to record attendance', async () => {
      const res = await request(app)
        .post('/api/academic/attendance')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          sectionId: secId,
          date: '2026-10-04',
          period: 1,
          records: [{ studentId: student1Id, status: 'PRESENT' }],
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Student Attendance Statistics (GET /api/academic/attendance)', () => {
    it('returns exact, mathematically calculated attendance percentage and subject breakdown', async () => {
      // Insert 4 classes: Alice attended 3 (75.0%), Bob attended 1 (25.0%)
      await request(app)
        .post('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          sectionId: secId,
          subjectId: subjectId,
          date: '2026-10-01',
          period: 1,
          records: [
            { studentId: student1Id, status: 'PRESENT' },
            { studentId: student2Id, status: 'ABSENT' },
          ],
        });

      await request(app)
        .post('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          sectionId: secId,
          subjectId: subjectId,
          date: '2026-10-02',
          period: 1,
          records: [
            { studentId: student1Id, status: 'PRESENT' },
            { studentId: student2Id, status: 'ABSENT' },
          ],
        });

      await request(app)
        .post('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          sectionId: secId,
          subjectId: subjectId,
          date: '2026-10-03',
          period: 1,
          records: [
            { studentId: student1Id, status: 'LATE' }, // LATE counts as attended
            { studentId: student2Id, status: 'PRESENT' },
          ],
        });

      await request(app)
        .post('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          sectionId: secId,
          subjectId: subjectId,
          date: '2026-10-04',
          period: 1,
          records: [
            { studentId: student1Id, status: 'ABSENT' },
            { studentId: student2Id, status: 'ABSENT' },
          ],
        });

      // Alice queries her own attendance
      const res = await request(app)
        .get('/api/academic/attendance')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.overall).toEqual({
        totalClasses: 4,
        attendedClasses: 3,
        absentClasses: 1,
        percentage: 75,
      });

      // Verify subject breakdown has real name and real percentage
      expect(res.body.bySubject).toHaveLength(1);
      expect(res.body.bySubject[0]).toEqual({
        subjectId: subjectId,
        subjectName: 'Data Structures',
        subjectCode: 'CS101',
        totalClasses: 4,
        attendedClasses: 3,
        percentage: 75,
      });

      // Verify recent records
      expect(res.body.recentRecords).toHaveLength(4);
      expect(res.body.recentRecords[0].date).toBe('2026-10-04');
      expect(res.body.recentRecords[0].status).toBe('ABSENT');
      expect(res.body.recentRecords[0].subjectName).toBe('Data Structures');
    });

    it('returns 100% when a student has zero attendance records yet', async () => {
      const res = await request(app)
        .get('/api/academic/attendance')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.overall.totalClasses).toBe(0);
      expect(res.body.overall.percentage).toBe(100);
      expect(res.body.bySubject).toHaveLength(0);
    });
  });
  describe('Audit regression: authorization is independent of filters', () => {
    async function addOtherSectionRecord() {
      const section = await db.select().from(sections).where(eq(sections.id, secId)).get();
      const otherSection = randomUUID();
      await db.insert(sections).values({ ...section!, id: otherSection, name: 'Other section' });
      await db.insert(attendanceRecords).values({
        id: randomUUID(), institutionId: instId, sectionId: otherSection,
        studentId: student2Id, subjectId, date: '2026-10-04', period: 1, status: 'PRESENT',
      });
      await db.insert(attendanceRecords).values({
        id: randomUUID(), institutionId: instId, sectionId: secId,
        studentId: student1Id, subjectId, date: '2026-10-04', period: 1, status: 'PRESENT',
      });
      return otherSection;
    }

    it.each(['date=2026-10-04', 'period=1', 'limit=1', ''])('cannot bypass section scope with %s', async (query) => {
      await addOtherSectionRecord();
      const res = await request(app).get(`/api/academic/attendance?${query}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.attendance).toHaveLength(1);
      expect(res.body.attendance[0].sectionId).toBe(secId);
    });

    it('subject-only filters do not widen section scope', async () => {
      await addOtherSectionRecord();
      const res = await request(app).get(`/api/academic/attendance?subjectId=${subjectId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.attendance.map((row: any) => row.sectionId)).toEqual([secId]);
    });

    it('returns no records for a teacher without active assignments', async () => {
      await addOtherSectionRecord();
      await db.delete(teachingAssignments);
      const res = await request(app).get('/api/academic/attendance?date=2026-10-04')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.attendance).toEqual([]);
    });

    it('rejects inactive teachers immediately with an existing access token', async () => {
      await db.update(teachers).set({ isActive: false }).where(eq(teachers.id, teacherId));
      const res = await request(app).get('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(401);
    });

    it('rejects inactive users immediately with an existing access token', async () => {
      await db.update(users).set({ isActive: false }).where(eq(users.id, teacherUserId));
      const res = await request(app).get('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(401);
    });

    it('does not accept attendance for students outside the section', async () => {
      await db.delete(enrollments).where(eq(enrollments.studentId, student2Id));
      const res = await request(app).post('/api/academic/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ sectionId: secId, date: '2026-10-04', records: [{ studentId: student2Id, status: 'PRESENT' }] });
      expect(res.status).toBe(400);
      expect(await db.select().from(attendanceRecords)).toEqual([]);
    });

    it('rejects duplicate students and invalid calendar dates', async () => {
      for (const payload of [
        { date: '2026-02-30', records: [{ studentId: student1Id, status: 'PRESENT' }] },
        { date: '2026-10-04', records: [{ studentId: student1Id, status: 'PRESENT' }, { studentId: student1Id, status: 'ABSENT' }] },
      ]) {
        const res = await request(app).post('/api/academic/attendance')
          .set('Authorization', `Bearer ${teacherToken}`).send({ sectionId: secId, ...payload });
        expect(res.status).toBe(400);
      }
      expect(await db.select().from(attendanceRecords)).toEqual([]);
    });
  });

});

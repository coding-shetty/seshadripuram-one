import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import {
  academicYears,
  announcements,
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
  timetableEntries,
  users,
} from '../src/db/schema';
import { createApp } from '../src/index';
import { createAccessToken } from '../src/services/tokenService';

const app = createApp();

function token(userId: string, role: 'STUDENT' | 'TEACHER' | 'ADMIN', institutionId: string): string {
  return createAccessToken({ sub: userId, role, institutionId });
}

describe('academic data scoping across institutions and sections', () => {
  let instAId: string;
  let instBId: string;
  let secAId: string;
  let secBId: string;
  let studentAUserId: string;
  let studentBUserId: string;
  let teacherAUserId: string;
  let teacherBUserId: string;
  let timetableSecAId: string;
  let timetableSecBId: string;
  let timetableInstBId: string;
  let announcementInstAId: string;
  let announcementSecAId: string;
  let announcementSecBId: string;
  let announcementInstBId: string;

  async function cleanupAll() {
    await db.delete(teachingAssignments);
    await db.delete(enrollments);
    await db.delete(subjectOfferings);
    await db.delete(timetableEntries);
    await db.delete(announcements);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);
    await db.delete(sections);
    await db.delete(semesters);
    await db.delete(subjects);
    await db.delete(programs);
    await db.delete(academicYears);
    await db.delete(departments);
    await db.delete(institutions);
  }

  afterEach(async () => {
    await cleanupAll();
  });

  beforeEach(async () => {
    await cleanupAll();

    // Setup 2 Institutions
    instAId = randomUUID();
    instBId = randomUUID();
    await db.insert(institutions).values([
      { id: instAId, code: 'INST-A', name: 'Institution A' },
      { id: instBId, code: 'INST-B', name: 'Institution B' },
    ]);

    // Departments
    const deptAId = randomUUID();
    const deptBId = randomUUID();
    await db.insert(departments).values([
      { id: deptAId, institutionId: instAId, code: 'CS-A', name: 'CS Dept A' },
      { id: deptBId, institutionId: instBId, code: 'CS-B', name: 'CS Dept B' },
    ]);

    // Programs
    const progAId = randomUUID();
    const progBId = randomUUID();
    await db.insert(programs).values([
      { id: progAId, departmentId: deptAId, code: 'BCA-A', name: 'BCA A', level: 'UG', durationSemesters: 6 },
      { id: progBId, departmentId: deptBId, code: 'BCA-B', name: 'BCA B', level: 'UG', durationSemesters: 6 },
    ]);

    // Academic Years
    const ayAId = randomUUID();
    const ayBId = randomUUID();
    await db.insert(academicYears).values([
      { id: ayAId, institutionId: instAId, label: '2026-27', startDate: '2026-06-01', endDate: '2027-05-31' },
      { id: ayBId, institutionId: instBId, label: '2026-27', startDate: '2026-06-01', endDate: '2027-05-31' },
    ]);

    // Semesters
    const semAId = randomUUID();
    const semBId = randomUUID();
    await db.insert(semesters).values([
      { id: semAId, academicYearId: ayAId, number: 1, label: 'Sem 1' },
      { id: semBId, academicYearId: ayBId, number: 1, label: 'Sem 1' },
    ]);

    // Sections: Section A in Inst A, Section B in Inst A, and Section in Inst B
    secAId = randomUUID();
    secBId = randomUUID();
    const secInstBId = randomUUID();
    await db.insert(sections).values([
      { id: secAId, programId: progAId, academicYearId: ayAId, semesterId: semAId, name: 'BCA 1A' },
      { id: secBId, programId: progAId, academicYearId: ayAId, semesterId: semAId, name: 'BCA 1B' },
      { id: secInstBId, programId: progBId, academicYearId: ayBId, semesterId: semBId, name: 'BCA 1-INST-B' },
    ]);

    // Subjects & Offerings
    const subAId = randomUUID();
    const subBId = randomUUID();
    await db.insert(subjects).values([
      { id: subAId, departmentId: deptAId, code: 'CS101', name: 'Intro CS' },
      { id: subBId, departmentId: deptAId, code: 'CS102', name: 'Data Structures' },
    ]);
    const offeringAId = randomUUID();
    const offeringBId = randomUUID();
    await db.insert(subjectOfferings).values([
      { id: offeringAId, subjectId: subAId, sectionId: secAId, semesterId: semAId },
      { id: offeringBId, subjectId: subBId, sectionId: secBId, semesterId: semAId },
    ]);

    // Users: Student A in Sec A, Student B in Sec B
    studentAUserId = randomUUID();
    studentBUserId = randomUUID();
    teacherAUserId = randomUUID();
    teacherBUserId = randomUUID();

    await db.insert(users).values([
      { id: studentAUserId, role: 'STUDENT', institutionId: 'STU-A', accountStatus: 'ACTIVE' },
      { id: studentBUserId, role: 'STUDENT', institutionId: 'STU-B', accountStatus: 'ACTIVE' },
      { id: teacherAUserId, role: 'TEACHER', institutionId: 'TEA-A', accountStatus: 'ACTIVE' },
      { id: teacherBUserId, role: 'TEACHER', institutionId: 'TEA-B', accountStatus: 'ACTIVE' },
    ]);

    const stuAId = randomUUID();
    const stuBId = randomUUID();
    await db.insert(students).values([
      { id: stuAId, userId: studentAUserId, studentId: 'STU-A', fullName: 'Student A', contactEmail: 'stua@test.edu' },
      { id: stuBId, userId: studentBUserId, studentId: 'STU-B', fullName: 'Student B', contactEmail: 'stub@test.edu' },
    ]);

    // Enrollments
    await db.insert(enrollments).values([
      { id: randomUUID(), studentId: stuAId, sectionId: secAId, academicYearId: ayAId, semesterId: semAId, status: 'ACTIVE' },
      { id: randomUUID(), studentId: stuBId, sectionId: secBId, academicYearId: ayAId, semesterId: semAId, status: 'ACTIVE' },
    ]);

    // Teachers & Assignments
    const teaAId = randomUUID();
    const teaBId = randomUUID();
    await db.insert(teachers).values([
      { id: teaAId, userId: teacherAUserId, employeeId: 'TEA-A', fullName: 'Prof A', contactEmail: 'teaA@test.edu' },
      { id: teaBId, userId: teacherBUserId, employeeId: 'TEA-B', fullName: 'Prof B', contactEmail: 'teaB@test.edu' },
    ]);
    await db.insert(teachingAssignments).values([
      { id: randomUUID(), teacherId: teaAId, subjectOfferingId: offeringAId, assignmentRole: 'PRIMARY' },
      { id: randomUUID(), teacherId: teaBId, subjectOfferingId: offeringBId, assignmentRole: 'PRIMARY' },
    ]);

    // Timetable Entries:
    // 1 in Inst A, Section A
    // 1 in Inst A, Section B
    // 1 in Inst B
    timetableSecAId = randomUUID();
    timetableSecBId = randomUUID();
    timetableInstBId = randomUUID();
    await db.insert(timetableEntries).values([
      {
        id: timetableSecAId,
        institutionId: instAId,
        sectionId: secAId,
        teacherId: teaAId,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
        subject: 'Intro CS',
        teacherName: 'Prof A',
        room: '101',
        sectionName: 'BCA 1A',
        isActive: true,
      },
      {
        id: timetableSecBId,
        institutionId: instAId,
        sectionId: secBId,
        teacherId: teaBId,
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Data Structures',
        teacherName: 'Prof B',
        room: '102',
        sectionName: 'BCA 1B',
        isActive: true,
      },
      {
        id: timetableInstBId,
        institutionId: instBId,
        sectionId: secInstBId,
        dayOfWeek: 1,
        startTime: '11:00',
        endTime: '12:00',
        subject: 'Inst B Subject',
        teacherName: 'Prof X',
        room: 'B-101',
        sectionName: 'BCA 1-INST-B',
        isActive: true,
      },
    ]);

    // Announcements:
    // 1 general for Inst A
    // 1 section A specific for Inst A
    // 1 section B specific for Inst A
    // 1 general for Inst B
    announcementInstAId = randomUUID();
    announcementSecAId = randomUUID();
    announcementSecBId = randomUUID();
    announcementInstBId = randomUUID();
    await db.insert(announcements).values([
      {
        id: announcementInstAId,
        institutionId: instAId,
        title: 'Inst A Campus Notice',
        body: 'Welcome to Inst A',
        category: 'GENERAL',
        audienceRole: 'ALL',
        publishedAt: '2026-08-22T09:00:00.000Z',
        isPublished: true,
      },
      {
        id: announcementSecAId,
        institutionId: instAId,
        sectionId: secAId,
        title: 'Section A Assignment',
        body: 'Assignment 1 due next week for Section A',
        category: 'ACADEMIC',
        audienceRole: 'STUDENT',
        publishedAt: '2026-08-22T09:30:00.000Z',
        isPublished: true,
      },
      {
        id: announcementSecBId,
        institutionId: instAId,
        sectionId: secBId,
        title: 'Section B Lab Notice',
        body: 'Lab 2 venue changed for Section B',
        category: 'ACADEMIC',
        audienceRole: 'STUDENT',
        publishedAt: '2026-08-22T09:45:00.000Z',
        isPublished: true,
      },
      {
        id: announcementInstBId,
        institutionId: instBId,
        title: 'Inst B Only Notice',
        body: 'Holiday notice for Inst B',
        category: 'GENERAL',
        audienceRole: 'ALL',
        publishedAt: '2026-08-22T10:00:00.000Z',
        isPublished: true,
      },
    ]);
  });

  it('scopes timetable strictly by institution and section for students', async () => {
    const res = await request(app)
      .get('/api/academic/timetable')
      .set('Authorization', `Bearer ${token(studentAUserId, 'STUDENT', 'STU-A')}`)
      .expect(200);

    const ids = res.body.timetable.map((t: { id: string }) => t.id);
    expect(ids).toContain(timetableSecAId);
    expect(ids).not.toContain(timetableSecBId);
    expect(ids).not.toContain(timetableInstBId);
  });

  it('scopes timetable to assigned sections for teachers', async () => {
    const res = await request(app)
      .get('/api/academic/timetable')
      .set('Authorization', `Bearer ${token(teacherAUserId, 'TEACHER', 'TEA-A')}`)
      .expect(200);

    const ids = res.body.timetable.map((t: { id: string }) => t.id);
    expect(ids).toContain(timetableSecAId);
    expect(ids).not.toContain(timetableSecBId);
    expect(ids).not.toContain(timetableInstBId);
  });

  it('scopes announcements strictly by institution and section for students', async () => {
    const res = await request(app)
      .get('/api/academic/announcements')
      .set('Authorization', `Bearer ${token(studentAUserId, 'STUDENT', 'STU-A')}`)
      .expect(200);

    const ids = res.body.announcements.map((a: { id: string }) => a.id);
    // Student in Section A of Inst A should see Inst A general notice and Section A notice
    expect(ids).toContain(announcementInstAId);
    expect(ids).toContain(announcementSecAId);
    // Must NOT see Section B notice or Inst B notices
    expect(ids).not.toContain(announcementSecBId);
    expect(ids).not.toContain(announcementInstBId);
  });

  it("prevents a teacher from modifying or posting to another teacher's section", async () => {
    // Teacher A tries to submit attendance for Section B (taught by Teacher B)
    await request(app)
      .post('/api/academic/attendance')
      .set('Authorization', `Bearer ${token(teacherAUserId, 'TEACHER', 'TEA-A')}`)
      .send({ sectionId: secBId })
      .expect(403);

    // Teacher A tries to post an announcement targeted to Section B
    await request(app)
      .post('/api/academic/announcements')
      .set('Authorization', `Bearer ${token(teacherAUserId, 'TEACHER', 'TEA-A')}`)
      .send({ title: 'Unauthorized Notice', body: 'This should fail', sectionId: secBId })
      .expect(403);
  });
});


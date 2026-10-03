import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../src/db';
import {
  academicYears,
  assessments,
  auditLogs,
  departments,
  enrollments,
  institutions,
  programs,
  sections,
  semesters,
  studentMarks,
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

describe('Academic Internal Marks & Grade Card Lifecycle', () => {
  const app = createApp();

  const instId = 'inst-grades-test';
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
    await db.delete(studentMarks);
    await db.delete(assessments);
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

    // 1. Institution, Dept, Program, Year, Semester, Section
    await db.insert(institutions).values({
      id: instId,
      code: 'SET-GRADE',
      name: 'Seshadripuram Test College',
    });

    const deptId = randomUUID();
    await db.insert(departments).values({
      id: deptId,
      institutionId: instId,
      code: 'BCA-DEPT',
      name: 'Department of Computer Applications',
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
      number: 4,
      label: 'Semester 4',
      isCurrent: true,
    });

    secId = randomUUID();
    await db.insert(sections).values({
      id: secId,
      programId: progId,
      academicYearId: acadId,
      semesterId: semId,
      name: 'BCA 4A',
    });

    subjectId = randomUUID();
    await db.insert(subjects).values({
      id: subjectId,
      departmentId: deptId,
      code: 'BCA401',
      name: 'Web Application Development',
      credits: 4,
    });

    const offeringId = randomUUID();
    await db.insert(subjectOfferings).values({
      id: offeringId,
      subjectId,
      sectionId: secId,
      semesterId: semId,
    });

    // 2. Teacher
    teacherUserId = randomUUID();
    teacherId = randomUUID();
    await db.insert(users).values({
      id: teacherUserId,
      role: 'TEACHER',
      accountStatus: 'ACTIVE',
      institutionId: 'TCH-001',
      collegeId: instId,
      contactEmail: 'teacher@seshadripuram.ac.in',
    });
    await db.insert(teachers).values({
      id: teacherId,
      userId: teacherUserId,
      employeeId: 'TCH-001',
      fullName: 'Prof. Ramesh Kumar',
      contactEmail: 'teacher@seshadripuram.ac.in',
    });
    await db.insert(teachingAssignments).values({
      id: randomUUID(),
      teacherId,
      subjectOfferingId: offeringId,
      assignmentRole: 'PRIMARY',
    });

    // 3. Students
    student1UserId = randomUUID();
    student1Id = randomUUID();
    await db.insert(users).values({
      id: student1UserId,
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
      institutionId: 'STU-001',
      collegeId: instId,
      contactEmail: 'student1@seshadripuram.ac.in',
    });
    await db.insert(students).values({
      id: student1Id,
      userId: student1UserId,
      studentId: 'STU-001',
      fullName: 'Aarav Sharma',
      contactEmail: 'student1@seshadripuram.ac.in',
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
      accountStatus: 'ACTIVE',
      institutionId: 'STU-002',
      collegeId: instId,
      contactEmail: 'student2@seshadripuram.ac.in',
    });
    await db.insert(students).values({
      id: student2Id,
      userId: student2UserId,
      studentId: 'STU-002',
      fullName: 'Diya Patel',
      contactEmail: 'student2@seshadripuram.ac.in',
    });
    await db.insert(enrollments).values({
      id: randomUUID(),
      studentId: student2Id,
      sectionId: secId,
      academicYearId: acadId,
      semesterId: semId,
      status: 'ACTIVE',
    });

    teacherToken = createAccessToken({
      sub: teacherUserId,
      institutionId: 'TCH-001',
      role: 'TEACHER',
    });

    student1Token = createAccessToken({
      sub: student1UserId,
      institutionId: 'STU-001',
      role: 'STUDENT',
    });
  });

  it('allows teacher to create assessment and rejects unauthorized callers', async () => {
    // Student cannot create assessment
    const studentRes = await request(app)
      .post(`/api/academic/sections/${secId}/assessments`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: 'Internal Assessment 1',
        assessmentType: 'IA1',
        subjectId,
        maxMarks: 25,
        date: '2026-10-04',
      });
    expect(studentRes.status).toBe(403);

    // Teacher creates assessment
    const res = await request(app)
      .post(`/api/academic/sections/${secId}/assessments`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Internal Assessment 1',
        assessmentType: 'IA1',
        subjectId,
        maxMarks: 25,
        date: '2026-10-04',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('created');
    expect(res.body.assessmentId).toBeDefined();

    // Verify in DB
    const dbAssessment = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, res.body.assessmentId))
      .get();
    expect(dbAssessment).toBeDefined();
    expect(dbAssessment!.title).toBe('Internal Assessment 1');
    expect(dbAssessment!.maxMarks).toBe(25);

    // Verify audit log
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'ASSESSMENT_CREATED'));
    expect(logs.length).toBe(1);
  });

  it('lists section assessments and subjects for teacher', async () => {
    // Create an assessment first
    await request(app)
      .post(`/api/academic/sections/${secId}/assessments`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'IA-1 Midterm',
        assessmentType: 'IA1',
        subjectId,
        maxMarks: 30,
        date: '2026-10-04',
      });

    const res = await request(app)
      .get(`/api/academic/sections/${secId}/assessments`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.section.name).toBe('BCA 4A');
    expect(res.body.subjects.length).toBe(1);
    expect(res.body.subjects[0].code).toBe('BCA401');
    expect(res.body.assessments.length).toBe(1);
    expect(res.body.assessments[0].title).toBe('IA-1 Midterm');
    expect(res.body.assessments[0].maxMarks).toBe(30);
    expect(res.body.assessments[0].totalStudentsCount).toBe(2);
    expect(res.body.assessments[0].marksEnteredCount).toBe(0);
  });

  it('allows teacher to submit student marks with strict validation', async () => {
    const createRes = await request(app)
      .post(`/api/academic/sections/${secId}/assessments`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'IA-1',
        assessmentType: 'IA1',
        subjectId,
        maxMarks: 25,
        date: '2026-10-04',
      });
    const assessmentId = createRes.body.assessmentId;

    // 1. Rejects marks > maxMarks
    const invalidRes = await request(app)
      .post(`/api/academic/assessments/${assessmentId}/marks`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        records: [
          { studentId: student1Id, marksObtained: 30, status: 'PRESENT' },
        ],
      });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error).toContain('between 0 and maximum marks');

    // 2. Successful marks entry
    const validRes = await request(app)
      .post(`/api/academic/assessments/${assessmentId}/marks`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        records: [
          { studentId: student1Id, marksObtained: 23.5, status: 'PRESENT', remarks: 'Good grasp of concepts' },
          { studentId: student2Id, marksObtained: null, status: 'ABSENT', remarks: 'Medical leave' },
        ],
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.status).toBe('recorded');
    expect(validRes.body.recordedCount).toBe(2);

    // 3. Verify teacher roster view
    const rosterRes = await request(app)
      .get(`/api/academic/assessments/${assessmentId}/marks`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.students.length).toBe(2);
    const stu1 = rosterRes.body.students.find((s: any) => s.studentId === student1Id);
    expect(stu1.marksObtained).toBe(23.5);
    expect(stu1.status).toBe('PRESENT');
    const stu2 = rosterRes.body.students.find((s: any) => s.studentId === student2Id);
    expect(stu2.status).toBe('ABSENT');
    expect(stu2.remarks).toBe('Medical leave');
  });

  it('calculates real, authentic grade card and percentage for student', async () => {
    // Create 2 assessments: IA1 (max 25) and Assignment (max 25)
    const ia1Res = await request(app)
      .post(`/api/academic/sections/${secId}/assessments`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Internal Assessment 1',
        assessmentType: 'IA1',
        subjectId,
        maxMarks: 25,
        date: '2026-09-15',
      });
    const ia1Id = ia1Res.body.assessmentId;

    const assignRes = await request(app)
      .post(`/api/academic/sections/${secId}/assessments`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Practical Assignment',
        assessmentType: 'ASSIGNMENT',
        subjectId,
        maxMarks: 25,
        date: '2026-09-30',
      });
    const assignId = assignRes.body.assessmentId;

    // Submit marks for student 1: IA1 = 20/25, Assignment = 22.5/25 -> Total 42.5/50 = 85.0% (A+)
    await request(app)
      .post(`/api/academic/assessments/${ia1Id}/marks`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        records: [{ studentId: student1Id, marksObtained: 20, status: 'PRESENT' }],
      });

    await request(app)
      .post(`/api/academic/assessments/${assignId}/marks`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        records: [{ studentId: student1Id, marksObtained: 22.5, status: 'PRESENT' }],
      });

    // Student 1 fetches grade card
    const gradeCardRes = await request(app)
      .get('/api/academic/my-grades')
      .set('Authorization', `Bearer ${student1Token}`);

    expect(gradeCardRes.status).toBe(200);
    expect(gradeCardRes.body.student.fullName).toBe('Aarav Sharma');
    expect(gradeCardRes.body.overall.totalMarksScored).toBe(42.5);
    expect(gradeCardRes.body.overall.totalMaxMarks).toBe(50);
    expect(gradeCardRes.body.overall.percentage).toBe(85.0);
    expect(gradeCardRes.body.overall.classification).toBe('First Class with Distinction');

    expect(gradeCardRes.body.subjects.length).toBe(1);
    const sub = gradeCardRes.body.subjects[0];
    expect(sub.subjectCode).toBe('BCA401');
    expect(sub.totalScored).toBe(42.5);
    expect(sub.totalMax).toBe(50);
    expect(sub.percentage).toBe(85.0);
    expect(sub.gradeLetter).toBe('A+');
    expect(sub.gradeDescription).toBe('Excellent');
    expect(sub.assessments.length).toBe(2);
  });
});

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
  leaveRequests,
  programs,
  sections,
  semesters,
  students,
  teachers,
  teachingAssignments,
  users,
} from '../src/db/schema';
import { createApp } from '../src';
import { createAccessToken } from '../src/services/tokenService';
import { assertSafeCleanup } from './helpers/cleanDb';

describe('Student Leave & On-Duty (OD) Workflow', () => {
  const app = createApp();

  const instId = 'inst-leave-test';
  let secId: string;
  let studentUserId: string;
  let studentId: string;
  let teacherUserId: string;
  let teacherId: string;

  let studentToken: string;
  let teacherToken: string;

  beforeEach(async () => {
    assertSafeCleanup();
    await db.delete(leaveRequests);
    await db.delete(attendanceRecords);
    await db.delete(teachingAssignments);
    await db.delete(enrollments);
    await db.delete(auditLogs);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);
    await db.delete(sections);
    await db.delete(semesters);
    await db.delete(programs);
    await db.delete(departments);
    await db.delete(academicYears);
    await db.delete(institutions);

    await db.insert(institutions).values({
      id: instId,
      name: 'Seshadripuram College Main',
      code: 'SCM-LEAVE',
      address: 'Seshadripuram, Bengaluru',
      status: 'ACTIVE',
    });

    const ayId = 'ay-2026-leave';
    await db.insert(academicYears).values({
      id: ayId,
      institutionId: instId,
      label: '2026-2027',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      isCurrent: true,
    });

    const deptId = 'dept-bca-leave';
    await db.insert(departments).values({
      id: deptId,
      institutionId: instId,
      name: 'Computer Applications',
      code: 'BCA-LEAVE',
    });

    const progId = 'prog-bca-leave';
    await db.insert(programs).values({
      id: progId,
      departmentId: deptId,
      name: 'Bachelor of Computer Applications',
      code: 'BCA-PROG-LEAVE',
      level: 'UG',
      durationSemesters: 6,
    });

    const semId = 'sem-4-leave';
    await db.insert(semesters).values({
      id: semId,
      academicYearId: ayId,
      number: 4,
      label: 'Semester 4',
      isCurrent: true,
    });

    secId = 'sec-bca-4a-leave';
    await db.insert(sections).values({
      id: secId,
      programId: progId,
      semesterId: semId,
      name: 'BCA 4A',
      academicYearId: ayId,
      isActive: true,
    });

    // Create Student User & Profile
    studentUserId = 'user-student-leave';
    studentId = 'student-aarav-leave';
    await db.insert(users).values({
      id: studentUserId,
      collegeId: instId,
      institutionId: 'STUDENT-LEAVE-001',
      role: 'STUDENT',
      contactEmail: 'aarav.leave@seshadripuram.ac.in',
      accountStatus: 'ACTIVE',
      isActive: true,
    });
    await db.insert(students).values({
      id: studentId,
      userId: studentUserId,
      studentId: 'STUDENT-LEAVE-001',
      fullName: 'Aarav Sharma',
      contactEmail: 'aarav.leave@seshadripuram.ac.in',
      isActive: true,
    });
    await db.insert(enrollments).values({
      id: 'enr-aarav-leave',
      studentId: studentId,
      sectionId: secId,
      semesterId: semId,
      academicYearId: ayId,
      status: 'ACTIVE',
    });

    // Create Teacher User & Profile
    teacherUserId = 'user-teacher-leave';
    teacherId = 'teacher-ramesh-leave';
    await db.insert(users).values({
      id: teacherUserId,
      collegeId: instId,
      institutionId: 'TEACHER-LEAVE-001',
      role: 'TEACHER',
      contactEmail: 'ramesh.leave@seshadripuram.ac.in',
      accountStatus: 'ACTIVE',
      isActive: true,
    });
    await db.insert(teachers).values({
      id: teacherId,
      userId: teacherUserId,
      employeeId: 'TEACHER-LEAVE-001',
      fullName: 'Prof. Ramesh Kumar',
      contactEmail: 'ramesh.leave@seshadripuram.ac.in',
      isActive: true,
    });

    studentToken = createAccessToken({ sub: studentUserId, role: 'STUDENT', institutionId: instId });
    teacherToken = createAccessToken({ sub: teacherUserId, role: 'TEACHER', institutionId: instId });
  });

  it('allows a student to submit a valid Leave / On-Duty request', async () => {
    const res = await request(app)
      .post('/api/academic/leave-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        leaveType: 'ON_DUTY_SPORTS',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        reason: 'Inter-collegiate Football Tournament representing College',
        documentUrl: 'https://docs.seshadripuram.ac.in/od/sports-circular.pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.leaveRequest).toBeDefined();
    expect(res.body.leaveRequest.leaveType).toBe('ON_DUTY_SPORTS');
    expect(res.body.leaveRequest.status).toBe('PENDING');
    expect(res.body.leaveRequest.studentId).toBe(studentId);

    // Verify audit log
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'LEAVE_REQUESTED'));
    expect(logs.length).toBe(1);
    expect(logs[0].details).toContain('ON_DUTY_SPORTS');
  });

  it('rejects leave requests with invalid dates or too short reason', async () => {
    // End date before start date
    const resInvalidDates = await request(app)
      .post('/api/academic/leave-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        leaveType: 'MEDICAL',
        startDate: '2026-10-15',
        endDate: '2026-10-10',
        reason: 'Severe fever with medical certificate',
      });
    expect(resInvalidDates.status).toBe(400);
    expect(resInvalidDates.body.error).toContain('Start date cannot be after end date');

    // Reason too short
    const resShortReason = await request(app)
      .post('/api/academic/leave-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        leaveType: 'PERSONAL',
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        reason: 'sick',
      });
    expect(resShortReason.status).toBe(400);
  });

  it('allows student to view their own leave requests', async () => {
    // Insert a leave request directly
    await db.insert(leaveRequests).values({
      id: 'leave-aarav-1',
      institutionId: instId,
      studentId: studentId,
      leaveType: 'MEDICAL',
      startDate: '2026-10-05',
      endDate: '2026-10-06',
      reason: 'Doctor advised bed rest for viral infection',
      status: 'APPROVED',
      reviewedByTeacherId: teacherId,
      reviewRemarks: 'Approved. Submit medical fitness certificate on return.',
      reviewedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .get('/api/academic/my-leave-requests')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leaveRequests)).toBe(true);
    expect(res.body.leaveRequests.length).toBe(1);
    expect(res.body.leaveRequests[0].id).toBe('leave-aarav-1');
    expect(res.body.leaveRequests[0].status).toBe('APPROVED');
    expect(res.body.leaveRequests[0].reviewedByTeacherName).toBe('Prof. Ramesh Kumar');
  });

  it('allows teacher to view section leave requests and review them', async () => {
    const leaveId = 'leave-aarav-pending';
    await db.insert(leaveRequests).values({
      id: leaveId,
      institutionId: instId,
      studentId: studentId,
      leaveType: 'ON_DUTY_CULTURAL',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
      reason: 'State-level debate competition at Bangalore University',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 1. Teacher views section leave requests
    const resView = await request(app)
      .get('/api/academic/section-leave-requests?status=PENDING')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(resView.status).toBe(200);
    expect(resView.body.leaveRequests.length).toBe(1);
    expect(resView.body.leaveRequests[0].studentFullName).toBe('Aarav Sharma');
    expect(resView.body.leaveRequests[0].sectionName).toBe('BCA 4A');

    // 2. Teacher approves the request
    const resReview = await request(app)
      .patch(`/api/academic/leave-requests/${leaveId}/review`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        status: 'APPROVED',
        reviewRemarks: 'OD granted for inter-collegiate competition representation.',
      });

    expect(resReview.status).toBe(200);
    expect(resReview.body.leaveRequest.status).toBe('APPROVED');
    expect(resReview.body.leaveRequest.reviewedByTeacherId).toBe(teacherId);

    // Verify audit
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'LEAVE_REVIEWED'));
    expect(logs.length).toBe(1);
    expect(logs[0].details).toContain('APPROVED');
  });

  it('includes approved leaves count in student attendance endpoint', async () => {
    await db.insert(leaveRequests).values({
      id: 'leave-approved-1',
      institutionId: instId,
      studentId: studentId,
      leaveType: 'ON_DUTY_SPORTS',
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      reason: 'University Sports Trials',
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .get('/api/academic/attendance')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.overall).toBeDefined();
    expect(res.body.overall.approvedLeavesCount).toBe(1);
  });
});

import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import {
  announcements,
  assessments,
  attendanceRecords,
  auditLogs,
  departments,
  enrollments,
  institutions,
  leaveRequests,
  programs,
  sections,
  studentMarks,
  students,
  subjectOfferings,
  subjects,
  teachers,
  teachingAssignments,
  timetableEntries,
  users,
} from '../db/schema';
import { requireAuthentication, requireRole } from '../middleware/auth';
import type { AppRole } from '../services/tokenService';

export const academicRouter = Router();

export async function sectionsForCollege(collegeId: string) {
  return db.select({ id: sections.id, name: sections.name, departmentId: departments.id })
    .from(sections)
    .innerJoin(programs, eq(sections.programId, programs.id))
    .innerJoin(departments, eq(programs.departmentId, departments.id))
    .where(and(eq(departments.institutionId, collegeId), eq(sections.isActive, true)));
}

async function canAccessSection(ctx: AcademicContext, role: AppRole, sectionId: string) {
  if (!ctx.institutionId) return false;
  if (role === 'TEACHER') return ctx.sectionIds.includes(sectionId);
  return (await sectionsForCollege(ctx.institutionId)).some((section) => section.id === sectionId);
}


interface AcademicContext {
  institutionId: string | null;
  sectionId: string | null;
  sectionName: string | null;
  departmentId: string | null;
  sectionIds: string[];
  sectionNames: string[];
  teacherId: string | null;
  studentId: string | null;
}

export async function resolveCallerAcademicContext(
  userId: string,
  role: AppRole,
  fallbackInstitutionId?: string,
): Promise<AcademicContext> {
  let institutionId: string | null = null;
  let sectionId: string | null = null;
  let sectionName: string | null = null;
  let departmentId: string | null = null;
  const sectionIds: string[] = [];
  const sectionNames: string[] = [];
  let teacherId: string | null = null;
  let studentId: string | null = null;

  if (role === 'STUDENT') {
    const student = await db.select().from(students).where(eq(students.userId, userId)).get();
    if (student) {
      studentId = student.id;
      const enrollment = await db
        .select()
        .from(enrollments)
        .where(and(eq(enrollments.studentId, student.id), eq(enrollments.status, 'ACTIVE')))
        .get();

      if (enrollment) {
        sectionId = enrollment.sectionId;
        const section = await db.select().from(sections).where(eq(sections.id, enrollment.sectionId)).get();
        if (section) {
          sectionName = section.name;
          const program = await db.select().from(programs).where(eq(programs.id, section.programId)).get();
          if (program) {
            const department = await db.select().from(departments).where(eq(departments.id, program.departmentId)).get();
            if (department) {
              departmentId = department.id;
              institutionId = department.institutionId;
            }
          }
        }
      }
    }
  } else if (role === 'TEACHER') {
    const teacher = await db.select().from(teachers).where(eq(teachers.userId, userId)).get();
    if (teacher) {
      teacherId = teacher.id;
      const assignments = await db
        .select()
        .from(teachingAssignments)
        .where(and(eq(teachingAssignments.teacherId, teacher.id), eq(teachingAssignments.isActive, true)));

      for (const assignment of assignments) {
        const offering = await db.select().from(subjectOfferings).where(eq(subjectOfferings.id, assignment.subjectOfferingId)).get();
        if (offering?.isActive) {
          sectionIds.push(offering.sectionId);
          const section = await db.select().from(sections).where(eq(sections.id, offering.sectionId)).get();
          if (section) {
            sectionNames.push(section.name);
            if (!institutionId) {
              const program = await db.select().from(programs).where(eq(programs.id, section.programId)).get();
              if (program) {
                const department = await db.select().from(departments).where(eq(departments.id, program.departmentId)).get();
                if (department) {
                  departmentId = department.id;
                  institutionId = department.institutionId;
                }
              }
            }
          }
        }
      }
    }
  }

  // College membership is separate from the login identifier in the JWT.
  // Existing academic links may resolve student/teacher scope; administrators
  // must always have an explicit membership. Never guess a college from a token.
  const account = await db.select().from(users).where(eq(users.id, userId)).get();
  if (account?.collegeId) {
    if (institutionId && institutionId !== account.collegeId) {
      return { institutionId: null, sectionId: null, sectionName: null,
        departmentId: null, sectionIds: [], sectionNames: [], teacherId: null, studentId: null };
    }
    institutionId = account.collegeId;
  }
  if (institutionId) {
    const college = await db.select().from(institutions).where(eq(institutions.id, institutionId)).get();
    if (!college?.isActive) institutionId = null;
  }
  // A teacher's assignments must not grant accidental access to another college.
  const permittedSections = institutionId ? await sectionsForCollege(institutionId) : [];
  const permittedIds = new Set(permittedSections.map((section) => section.id));
  const safeSectionIds = sectionIds.filter((id) => permittedIds.has(id));

  return {
    institutionId,
    sectionId,
    sectionName,
    departmentId,
    sectionIds: [...new Set(safeSectionIds)],
    sectionNames: [...new Set(sectionNames)],
    teacherId,
    studentId,
  };
}

const listAnnouncementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
});

academicRouter.get('/announcements', requireAuthentication, async (req, res) => {
  const queryResult = listAnnouncementsQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({ error: queryResult.error.issues[0]?.message ?? 'Invalid query parameters' });
  }
  const { limit } = queryResult.data;

  const role = req.auth!.role;
  const ctx = await resolveCallerAcademicContext(req.auth!.sub, role, req.auth!.institutionId);

  if (!ctx.institutionId) {
    return res.json({ announcements: [] });
  }

  const conditions = [
    eq(announcements.isPublished, true),
    eq(announcements.institutionId, ctx.institutionId),
    or(isNull(announcements.audienceRole), eq(announcements.audienceRole, role), eq(announcements.audienceRole, 'ALL')),
  ];

  if (role === 'STUDENT') {
    if (ctx.sectionId) {
      conditions.push(or(isNull(announcements.sectionId), eq(announcements.sectionId, ctx.sectionId)));
    } else {
      conditions.push(isNull(announcements.sectionId));
    }
    if (ctx.departmentId) {
      conditions.push(or(isNull(announcements.departmentId), eq(announcements.departmentId, ctx.departmentId)));
    } else {
      conditions.push(isNull(announcements.departmentId));
    }
  } else if (role === 'TEACHER') {
    const allowedDepartments = (await sectionsForCollege(ctx.institutionId))
      .filter((section) => ctx.sectionIds.includes(section.id)).map((section) => section.departmentId);
    conditions.push(allowedDepartments.length
      ? or(isNull(announcements.departmentId), inArray(announcements.departmentId, allowedDepartments))
      : isNull(announcements.departmentId));
    if (ctx.sectionIds.length > 0) {
      conditions.push(or(isNull(announcements.sectionId), inArray(announcements.sectionId, ctx.sectionIds)));
    } else {
      conditions.push(isNull(announcements.sectionId));
    }
  }

  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      category: announcements.category,
      publishedAt: announcements.publishedAt,
    })
    .from(announcements)
    .where(and(...conditions))
    .orderBy(desc(announcements.publishedAt))
    .limit(limit);

  return res.json({ announcements: rows });
});

const postAnnouncementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().min(1, 'Body is required').max(10000),
  category: z.enum(['GENERAL', 'ACADEMIC', 'EVENT', 'STAFF']).default('GENERAL'),
  audienceRole: z.enum(['ALL', 'STUDENT', 'TEACHER', 'ADMIN']).optional(),
  sectionId: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
});

academicRouter.post('/announcements', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const result = postAnnouncementSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid request body' });
  }

  const { title, body, category, audienceRole, sectionId, departmentId } = result.data;
  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);

  if (!ctx.institutionId) {
    return res.status(403).json({ error: 'Caller is not associated with an institution' });
  }

  if (req.auth!.role === 'TEACHER' && sectionId) {
    if (!ctx.sectionIds.includes(sectionId)) {
      return res.status(403).json({ error: 'You are not authorized to post announcements for this section' });
    }
  }

  if (sectionId && !(await canAccessSection(ctx, req.auth!.role, sectionId))) {
    return res.status(403).json({ error: 'Section is outside your permitted scope' });
  }
  if (departmentId) {
    const department = await db.select().from(departments).where(and(
      eq(departments.id, departmentId), eq(departments.institutionId, ctx.institutionId)
    )).get();
    if (!department || (req.auth!.role === 'TEACHER' && departmentId !== ctx.departmentId)) {
      return res.status(403).json({ error: 'Department is outside your permitted scope' });
    }
  }

  const id = randomUUID();
  await db.insert(announcements).values({
    id,
    institutionId: ctx.institutionId,
    departmentId: departmentId ?? ctx.departmentId ?? null,
    sectionId: sectionId ?? null,
    title,
    body,
    category,
    audienceRole: audienceRole ?? 'ALL',
    publishedAt: new Date().toISOString(),
    isPublished: true,
    createdByUserId: req.auth!.sub,
  });

  await db.insert(auditLogs).values({
    id: randomUUID(),
    action: 'ANNOUNCEMENT_CREATED',
    collegeId: ctx.institutionId,
    details: JSON.stringify({
      announcementId: id,
      authorUserId: req.auth!.sub,
      institutionId: ctx.institutionId,
      category,
      audienceRole: audienceRole ?? 'ALL',
    }),
  });

  return res.status(201).json({ status: 'created', id });
});

const listTimetableQuerySchema = z.object({
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(100),
});

academicRouter.get('/timetable', requireAuthentication, async (req, res) => {
  const queryResult = listTimetableQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({ error: queryResult.error.issues[0]?.message ?? 'Invalid query parameters' });
  }
  const { limit } = queryResult.data;

  const role = req.auth!.role;
  const ctx = await resolveCallerAcademicContext(req.auth!.sub, role, req.auth!.institutionId);

  if (!ctx.institutionId) {
    return res.json({ timetable: [] });
  }

  const conditions = [
    eq(timetableEntries.isActive, true),
    eq(timetableEntries.institutionId, ctx.institutionId),
  ];

  if (role === 'STUDENT') {
    const studentConditions = [];
    if (ctx.sectionId) studentConditions.push(eq(timetableEntries.sectionId, ctx.sectionId));

    if (studentConditions.length === 0) {
      return res.json({ timetable: [] });
    }
    const filter = or(...studentConditions);
    if (filter) conditions.push(filter);
  } else if (role === 'TEACHER') {
    const teacherConditions = [];
    if (ctx.teacherId) teacherConditions.push(eq(timetableEntries.teacherId, ctx.teacherId));
    if (ctx.sectionIds.length > 0) teacherConditions.push(inArray(timetableEntries.sectionId, ctx.sectionIds));

    if (teacherConditions.length === 0) {
      return res.json({ timetable: [] });
    }
    const filter = or(...teacherConditions);
    if (filter) conditions.push(filter);
  }

  const rows = await db
    .select({
      id: timetableEntries.id,
      dayOfWeek: timetableEntries.dayOfWeek,
      startTime: timetableEntries.startTime,
      endTime: timetableEntries.endTime,
      subject: timetableEntries.subject,
      teacherName: timetableEntries.teacherName,
      room: timetableEntries.room,
      sectionName: timetableEntries.sectionName,
    })
    .from(timetableEntries)
    .where(and(...conditions))
    .orderBy(asc(timetableEntries.dayOfWeek), asc(timetableEntries.startTime))
    .limit(limit);

  return res.json({ timetable: rows });
});

academicRouter.get('/my-sections', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (!ctx.institutionId) {
    return res.json({ sections: [] });
  }

  if (req.auth!.role === 'TEACHER') {
    if (ctx.sectionIds.length === 0) {
      return res.json({ sections: [] });
    }
    const teacherSections = await db
      .select({ id: sections.id, name: sections.name })
      .from(sections)
      .where(and(inArray(sections.id, ctx.sectionIds), eq(sections.isActive, true)))
      .orderBy(asc(sections.name));
    return res.json({ sections: teacherSections });
  }

  // Admin gets all active sections for the college
  const adminSections = await sectionsForCollege(ctx.institutionId);
  return res.json({ sections: adminSections.map((s) => ({ id: s.id, name: s.name })) });
});

academicRouter.get('/sections/:sectionId/students', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const sectionId = typeof req.params.sectionId === 'string' ? req.params.sectionId.trim() : '';
  if (!sectionId) {
    return res.status(400).json({ error: 'Section ID is required' });
  }

  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (req.auth!.role === 'TEACHER') {
    if (!ctx.sectionIds.includes(sectionId)) {
      return res.status(403).json({ error: 'You are not authorized to view students for this section' });
    }
  }

  if (!(await canAccessSection(ctx, req.auth!.role, sectionId))) {
    return res.status(403).json({ error: 'Section is outside your permitted scope' });
  }

  const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }

  const enrolled = await db
    .select({
      id: students.id,
      studentId: students.studentId,
      fullName: students.fullName,
      contactEmail: students.contactEmail,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(and(eq(enrollments.sectionId, sectionId), eq(enrollments.status, 'ACTIVE')))
    .orderBy(asc(students.studentId));

  return res.json({
    section: { id: section.id, name: section.name },
    students: enrolled,
  });
});

const postAttendanceSchema = z.object({
  sectionId: z.string().trim().min(1, 'sectionId is required'),
  subjectId: z.string().trim().optional(),
  date: z.iso.date(),
  period: z.coerce.number().int().min(1).max(12).default(1),
  records: z.array(
    z.object({
      studentId: z.string().trim().min(1, 'studentId is required'),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
      remarks: z.string().trim().max(250).optional(),
    })
  ).min(1, 'At least one student record is required').max(500),
});

academicRouter.post('/attendance', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const reqSectionId = typeof req.body?.sectionId === 'string' ? req.body.sectionId.trim() : undefined;
  if (req.auth!.role === 'TEACHER' && reqSectionId) {
    const ctx = await resolveCallerAcademicContext(req.auth!.sub, 'TEACHER', req.auth!.institutionId);
    if (!ctx.sectionIds.includes(reqSectionId)) {
      return res.status(403).json({ error: 'You are not authorized to manage attendance for this section' });
    }
  }

  const result = postAttendanceSchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid request body' });
  }
  const { sectionId, subjectId, date, period, records } = result.data;

  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (req.auth!.role === 'TEACHER') {
    if (!ctx.sectionIds.includes(sectionId)) {
      return res.status(403).json({ error: 'You are not authorized to record attendance for this section' });
    }
  }

  if (!(await canAccessSection(ctx, req.auth!.role, sectionId))) {
    return res.status(403).json({ error: 'Section is outside your permitted scope' });
  }
  if (new Set(records.map((record) => record.studentId)).size !== records.length) {
    return res.status(400).json({ error: 'Duplicate students in attendance submission' });
  }
  const enrolled = await db.select({ id: students.id }).from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.sectionId, sectionId), eq(enrollments.status, 'ACTIVE'), eq(students.isActive, true)));
  const enrolledIds = new Set(enrolled.map((student) => student.id));
  if (records.some((record) => !enrolledIds.has(record.studentId))) {
    return res.status(400).json({ error: 'Every student must be actively enrolled in this section' });
  }
  if (subjectId) {
    const offering = await db.select().from(subjectOfferings).where(and(
      eq(subjectOfferings.sectionId, sectionId), eq(subjectOfferings.subjectId, subjectId), eq(subjectOfferings.isActive, true)
    )).get();
    if (!offering) return res.status(400).json({ error: 'Subject is not offered in this section' });
    if (req.auth!.role === 'TEACHER') {
      const assignment = ctx.teacherId && await db.select().from(teachingAssignments).where(and(
        eq(teachingAssignments.teacherId, ctx.teacherId), eq(teachingAssignments.subjectOfferingId, offering.id), eq(teachingAssignments.isActive, true)
      )).get();
      if (!assignment) return res.status(403).json({ error: 'You are not assigned to this subject' });
    }
  }

  const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }

  const institutionId = ctx.institutionId;

  await db.transaction(async (tx) => {
    for (const rec of records) {
      const existing = await tx
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.sectionId, sectionId),
            eq(attendanceRecords.date, date),
            eq(attendanceRecords.period, period),
            eq(attendanceRecords.studentId, rec.studentId)
          )
        )
        .get();

      if (existing) {
        await tx
          .update(attendanceRecords)
          .set({
            status: rec.status,
            remarks: rec.remarks ?? null,
            subjectId: subjectId ?? null,
            teacherId: ctx.teacherId ?? null,
            recordedByUserId: req.auth!.sub,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(attendanceRecords.id, existing.id));
      } else {
        await tx.insert(attendanceRecords).values({
          id: randomUUID(),
          institutionId: institutionId ?? null,
          sectionId,
          subjectId: subjectId ?? null,
          teacherId: ctx.teacherId ?? null,
          date,
          period,
          studentId: rec.studentId,
          status: rec.status,
          remarks: rec.remarks ?? null,
          recordedByUserId: req.auth!.sub,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      action: 'ATTENDANCE_RECORDED',
      collegeId: ctx.institutionId,
      details: JSON.stringify({
        sectionId,
        date,
        period,
        subjectId: subjectId ?? null,
        recordCount: records.length,
        recordedByUserId: req.auth!.sub,
      }),
    });
  });

  return res.status(201).json({
    status: 'recorded',
    recordedCount: records.length,
    sectionId,
    date,
    period,
  });
});

const getAttendanceQuerySchema = z.object({
  sectionId: z.string().trim().optional(),
  date: z.string().trim().optional(),
  period: z.coerce.number().int().optional(),
  subjectId: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

academicRouter.get('/attendance', requireAuthentication, async (req, res) => {
  const queryResult = getAttendanceQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({ error: queryResult.error.issues[0]?.message ?? 'Invalid query parameters' });
  }

  const role = req.auth!.role;
  const ctx = await resolveCallerAcademicContext(req.auth!.sub, role, req.auth!.institutionId);

  if (role === 'STUDENT') {
    if (!ctx.studentId) {
      return res.json({
        overall: { totalClasses: 0, attendedClasses: 0, absentClasses: 0, percentage: 100 },
        bySubject: [],
        recentRecords: [],
      });
    }

    const records = await db
      .select({
        id: attendanceRecords.id,
        date: attendanceRecords.date,
        period: attendanceRecords.period,
        status: attendanceRecords.status,
        remarks: attendanceRecords.remarks,
        subjectId: attendanceRecords.subjectId,
      })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentId, ctx.studentId))
      .orderBy(desc(attendanceRecords.date), desc(attendanceRecords.period));

    const totalClasses = records.length;
    const attendedClasses = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const absentClasses = records.filter((r) => r.status === 'ABSENT').length;
    const percentage = totalClasses > 0 ? Number(((attendedClasses / totalClasses) * 100).toFixed(1)) : 100.0;

    const allSubjects = await db.select().from(subjects);
    const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));

    const subjectGroup = new Map<string, { total: number; attended: number }>();
    for (const r of records) {
      const subId = r.subjectId || 'GENERAL';
      const cur = subjectGroup.get(subId) || { total: 0, attended: 0 };
      cur.total++;
      if (r.status === 'PRESENT' || r.status === 'LATE') cur.attended++;
      subjectGroup.set(subId, cur);
    }

    const bySubject = Array.from(subjectGroup.entries()).map(([subId, stats]) => {
      const subject = subjectMap.get(subId);
      const subPercentage = stats.total > 0 ? Number(((stats.attended / stats.total) * 100).toFixed(1)) : 100.0;
      return {
        subjectId: subId,
        subjectName: subject?.name ?? (subId === 'GENERAL' ? 'General Academic' : 'Class Session'),
        subjectCode: subject?.code ?? 'GEN',
        totalClasses: stats.total,
        attendedClasses: stats.attended,
        percentage: subPercentage,
      };
    });

    const recentRecords = records.slice(0, 20).map((r) => ({
      id: r.id,
      date: r.date,
      period: r.period,
      status: r.status,
      remarks: r.remarks,
      subjectName: subjectMap.get(r.subjectId ?? '')?.name ?? 'Class Session',
    }));

    const studentLeaves = await db
      .select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.studentId, ctx.studentId!), eq(leaveRequests.status, 'APPROVED')));

    return res.json({
      overall: {
        totalClasses,
        attendedClasses,
        absentClasses,
        percentage,
        approvedLeavesCount: studentLeaves.length,
      },
      bySubject,
      recentRecords,
    });
  }

  // Teacher or Admin query
  const { sectionId, date, period, subjectId, limit } = queryResult.data;
  if (role === 'TEACHER') {
    if (sectionId && !ctx.sectionIds.includes(sectionId)) {
      return res.status(403).json({ error: 'You are not authorized to view attendance for this section' });
    }
  }

  const conditions = [];
  if (sectionId) conditions.push(eq(attendanceRecords.sectionId, sectionId));
  if (date) conditions.push(eq(attendanceRecords.date, date));
  if (period) conditions.push(eq(attendanceRecords.period, period));
  if (subjectId) conditions.push(eq(attendanceRecords.subjectId, subjectId));

  if (!ctx.institutionId) return res.json({ attendance: [] });
  const permittedSectionIds = role === 'TEACHER' ? ctx.sectionIds
    : (await sectionsForCollege(ctx.institutionId)).map((section) => section.id);
  if (permittedSectionIds.length === 0) return res.json({ attendance: [] });
  if (sectionId && !permittedSectionIds.includes(sectionId)) {
    return res.status(403).json({ error: 'Section is outside your permitted scope' });
  }
  conditions.push(inArray(attendanceRecords.sectionId, permittedSectionIds));
  conditions.push(eq(attendanceRecords.institutionId, ctx.institutionId));

  const rows = await db
    .select({
      id: attendanceRecords.id,
      sectionId: attendanceRecords.sectionId,
      studentId: attendanceRecords.studentId,
      studentName: students.fullName,
      studentInstitutionId: students.studentId,
      date: attendanceRecords.date,
      period: attendanceRecords.period,
      status: attendanceRecords.status,
      remarks: attendanceRecords.remarks,
      subjectId: attendanceRecords.subjectId,
    })
    .from(attendanceRecords)
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(attendanceRecords.date), desc(attendanceRecords.period))
    .limit(limit);

  return res.json({ attendance: rows });
});

// ==========================================
// INTERNAL MARKS & GRADE CARD SYSTEM
// ==========================================

academicRouter.get('/sections/:sectionId/assessments', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const sectionId = typeof req.params.sectionId === 'string' ? req.params.sectionId.trim() : '';
  if (!sectionId) {
    return res.status(400).json({ error: 'Section ID is required' });
  }

  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (req.auth!.role === 'TEACHER') {
    if (!ctx.sectionIds.includes(sectionId)) {
      return res.status(403).json({ error: 'You are not authorized to view assessments for this section' });
    }
  }

  if (!(await canAccessSection(ctx, req.auth!.role, sectionId))) {
    return res.status(403).json({ error: 'Section is outside your permitted scope' });
  }

  const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }

  // Get active subjects offered in this section
  const offerings = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      credits: subjects.credits,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .where(and(eq(subjectOfferings.sectionId, sectionId), eq(subjectOfferings.isActive, true)))
    .orderBy(asc(subjects.code));

  // Get total enrolled students
  const enrolledStudents = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.sectionId, sectionId), eq(enrollments.status, 'ACTIVE')));
  const totalStudentsCount = enrolledStudents.length;

  // Get assessments in this section
  const rows = await db
    .select({
      id: assessments.id,
      title: assessments.title,
      assessmentType: assessments.assessmentType,
      maxMarks: assessments.maxMarks,
      weightage: assessments.weightage,
      date: assessments.date,
      subjectId: assessments.subjectId,
      createdAt: assessments.createdAt,
    })
    .from(assessments)
    .where(eq(assessments.sectionId, sectionId))
    .orderBy(desc(assessments.date), desc(assessments.createdAt));

  const allMarks = await db.select({ assessmentId: studentMarks.assessmentId }).from(studentMarks);
  const marksCountMap = new Map<string, number>();
  for (const m of allMarks) {
    marksCountMap.set(m.assessmentId, (marksCountMap.get(m.assessmentId) || 0) + 1);
  }

  const subjectMap = new Map(offerings.map((s) => [s.id, s]));

  const enrichedAssessments = rows.map((a) => {
    const sub = subjectMap.get(a.subjectId);
    return {
      ...a,
      subjectName: sub?.name ?? 'Subject',
      subjectCode: sub?.code ?? 'SUB',
      marksEnteredCount: marksCountMap.get(a.id) || 0,
      totalStudentsCount,
    };
  });

  return res.json({
    section: { id: section.id, name: section.name },
    subjects: offerings,
    assessments: enrichedAssessments,
  });
});

const createAssessmentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  assessmentType: z.enum(['IA1', 'IA2', 'IA3', 'ASSIGNMENT', 'LAB', 'SEMESTER_EXAM']),
  subjectId: z.string().trim().min(1, 'Subject is required'),
  maxMarks: z.coerce.number().positive('Max marks must be greater than 0').max(1000),
  weightage: z.coerce.number().int().min(1).max(100).default(100),
  date: z.iso.date(),
});

academicRouter.post('/sections/:sectionId/assessments', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const sectionId = typeof req.params.sectionId === 'string' ? req.params.sectionId.trim() : '';
  if (!sectionId) {
    return res.status(400).json({ error: 'Section ID is required' });
  }

  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (req.auth!.role === 'TEACHER') {
    if (!ctx.sectionIds.includes(sectionId)) {
      return res.status(403).json({ error: 'You are not authorized to create assessments for this section' });
    }
  }

  if (!(await canAccessSection(ctx, req.auth!.role, sectionId))) {
    return res.status(403).json({ error: 'Section is outside your permitted scope' });
  }

  const result = createAssessmentSchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid request body' });
  }

  const { title, assessmentType, subjectId, maxMarks, weightage, date } = result.data;

  // Validate subject offering
  const offering = await db
    .select()
    .from(subjectOfferings)
    .where(and(eq(subjectOfferings.sectionId, sectionId), eq(subjectOfferings.subjectId, subjectId), eq(subjectOfferings.isActive, true)))
    .get();

  if (!offering) {
    return res.status(400).json({ error: 'Subject is not actively offered in this section' });
  }

  if (req.auth!.role === 'TEACHER' && ctx.teacherId) {
    const assignment = await db
      .select()
      .from(teachingAssignments)
      .where(and(eq(teachingAssignments.teacherId, ctx.teacherId), eq(teachingAssignments.subjectOfferingId, offering.id), eq(teachingAssignments.isActive, true)))
      .get();
    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject' });
    }
  }

  const id = randomUUID();
  await db.insert(assessments).values({
    id,
    institutionId: ctx.institutionId ?? null,
    sectionId,
    subjectId,
    title,
    assessmentType,
    maxMarks,
    weightage,
    date,
    createdById: req.auth!.sub,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.insert(auditLogs).values({
    id: randomUUID(),
    action: 'ASSESSMENT_CREATED',
    collegeId: ctx.institutionId,
    details: JSON.stringify({
      assessmentId: id,
      sectionId,
      subjectId,
      title,
      assessmentType,
      maxMarks,
      createdById: req.auth!.sub,
    }),
  });

  return res.status(201).json({ status: 'created', assessmentId: id });
});

academicRouter.get('/assessments/:assessmentId/marks', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const assessmentId = typeof req.params.assessmentId === 'string' ? req.params.assessmentId.trim() : '';
  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID is required' });
  }

  const assessment = await db.select().from(assessments).where(eq(assessments.id, assessmentId)).get();
  if (!assessment) {
    return res.status(404).json({ error: 'Assessment not found' });
  }

  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (req.auth!.role === 'TEACHER') {
    if (!ctx.sectionIds.includes(assessment.sectionId)) {
      return res.status(403).json({ error: 'You are not authorized to view marks for this section' });
    }
  }

  if (!(await canAccessSection(ctx, req.auth!.role, assessment.sectionId))) {
    return res.status(403).json({ error: 'Assessment is outside your permitted scope' });
  }

  const section = await db.select().from(sections).where(eq(sections.id, assessment.sectionId)).get();
  const subject = await db.select().from(subjects).where(eq(subjects.id, assessment.subjectId)).get();

  // Enrolled students in section
  const enrolled = await db
    .select({
      id: students.id,
      studentId: students.studentId,
      fullName: students.fullName,
      contactEmail: students.contactEmail,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(and(eq(enrollments.sectionId, assessment.sectionId), eq(enrollments.status, 'ACTIVE')))
    .orderBy(asc(students.studentId));

  // Current marks for this assessment
  const existingMarks = await db
    .select()
    .from(studentMarks)
    .where(eq(studentMarks.assessmentId, assessmentId));

  const marksMap = new Map(existingMarks.map((m) => [m.studentId, m]));

  const roster = enrolled.map((s) => {
    const mark = marksMap.get(s.id);
    return {
      studentId: s.id,
      studentInstitutionId: s.studentId,
      fullName: s.fullName,
      contactEmail: s.contactEmail,
      marksObtained: mark?.marksObtained ?? null,
      status: mark?.status ?? 'PRESENT',
      remarks: mark?.remarks ?? null,
    };
  });

  return res.json({
    assessment: {
      id: assessment.id,
      title: assessment.title,
      assessmentType: assessment.assessmentType,
      maxMarks: assessment.maxMarks,
      weightage: assessment.weightage,
      date: assessment.date,
      sectionId: assessment.sectionId,
      sectionName: section?.name ?? 'Section',
      subjectId: assessment.subjectId,
      subjectName: subject?.name ?? 'Subject',
      subjectCode: subject?.code ?? 'SUB',
    },
    students: roster,
  });
});

const submitMarksSchema = z.object({
  records: z.array(
    z.object({
      studentId: z.string().trim().min(1, 'studentId is required'),
      marksObtained: z.number().nullable().optional(),
      status: z.enum(['PRESENT', 'ABSENT', 'EXEMPTED']),
      remarks: z.string().trim().max(250).optional(),
    })
  ).min(1, 'At least one student record is required').max(500),
});

academicRouter.post('/assessments/:assessmentId/marks', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const assessmentId = typeof req.params.assessmentId === 'string' ? req.params.assessmentId.trim() : '';
  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID is required' });
  }

  const assessment = await db.select().from(assessments).where(eq(assessments.id, assessmentId)).get();
  if (!assessment) {
    return res.status(404).json({ error: 'Assessment not found' });
  }

  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (req.auth!.role === 'TEACHER') {
    if (!ctx.sectionIds.includes(assessment.sectionId)) {
      return res.status(403).json({ error: 'You are not authorized to record marks for this section' });
    }
  }

  if (!(await canAccessSection(ctx, req.auth!.role, assessment.sectionId))) {
    return res.status(403).json({ error: 'Assessment is outside your permitted scope' });
  }

  const result = submitMarksSchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid request body' });
  }

  const { records } = result.data;

  // Check duplicate students
  if (new Set(records.map((r) => r.studentId)).size !== records.length) {
    return res.status(400).json({ error: 'Duplicate student records in marks submission' });
  }

  // Validate all students enrolled in section
  const enrolled = await db
    .select({ id: students.id })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.sectionId, assessment.sectionId), eq(enrollments.status, 'ACTIVE'), eq(students.isActive, true)));
  const enrolledIds = new Set(enrolled.map((s) => s.id));

  for (const r of records) {
    if (!enrolledIds.has(r.studentId)) {
      return res.status(400).json({ error: `Student ${r.studentId} is not actively enrolled in this section` });
    }
    if (r.status === 'PRESENT') {
      if (r.marksObtained === undefined || r.marksObtained === null) {
        return res.status(400).json({ error: 'Marks obtained is required when status is PRESENT' });
      }
      if (r.marksObtained < 0 || r.marksObtained > assessment.maxMarks) {
        return res.status(400).json({ error: `Marks obtained must be between 0 and maximum marks (${assessment.maxMarks})` });
      }
    }
  }

  await db.transaction(async (tx) => {
    for (const rec of records) {
      const marksVal = rec.status === 'PRESENT' ? rec.marksObtained : null;
      const existing = await tx
        .select({ id: studentMarks.id })
        .from(studentMarks)
        .where(and(eq(studentMarks.assessmentId, assessmentId), eq(studentMarks.studentId, rec.studentId)))
        .get();

      if (existing) {
        await tx
          .update(studentMarks)
          .set({
            marksObtained: marksVal,
            status: rec.status,
            remarks: rec.remarks ?? null,
            gradedByUserId: req.auth!.sub,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(studentMarks.id, existing.id));
      } else {
        await tx.insert(studentMarks).values({
          id: randomUUID(),
          assessmentId,
          studentId: rec.studentId,
          marksObtained: marksVal,
          status: rec.status,
          remarks: rec.remarks ?? null,
          gradedByUserId: req.auth!.sub,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      action: 'MARKS_RECORDED',
      collegeId: ctx.institutionId,
      details: JSON.stringify({
        assessmentId,
        sectionId: assessment.sectionId,
        subjectId: assessment.subjectId,
        recordCount: records.length,
        recordedByUserId: req.auth!.sub,
      }),
    });
  });

  return res.status(200).json({
    status: 'recorded',
    recordedCount: records.length,
    assessmentId,
  });
});

function calculateGrade(percentage: number): { letter: string; description: string } {
  if (percentage >= 90) return { letter: 'O', description: 'Outstanding' };
  if (percentage >= 80) return { letter: 'A+', description: 'Excellent' };
  if (percentage >= 70) return { letter: 'A', description: 'Very Good' };
  if (percentage >= 60) return { letter: 'B+', description: 'Good' };
  if (percentage >= 50) return { letter: 'B', description: 'Above Average' };
  if (percentage >= 40) return { letter: 'C', description: 'Pass' };
  return { letter: 'F', description: 'Fail' };
}

function calculateClassification(percentage: number): string {
  if (percentage >= 75) return 'First Class with Distinction';
  if (percentage >= 60) return 'First Class';
  if (percentage >= 50) return 'Second Class';
  if (percentage >= 40) return 'Pass Class';
  return 'Needs Improvement';
}

academicRouter.get('/my-grades', requireAuthentication, requireRole('STUDENT'), async (req, res) => {
  const ctx = await resolveCallerAcademicContext(req.auth!.sub, 'STUDENT', req.auth!.institutionId);

  if (!ctx.studentId || !ctx.sectionId) {
    return res.json({
      student: null,
      overall: {
        totalMarksScored: 0,
        totalMaxMarks: 0,
        percentage: 100,
        classification: 'No active enrollments',
      },
      subjects: [],
    });
  }

  const student = await db.select().from(students).where(eq(students.id, ctx.studentId)).get();
  const section = await db.select().from(sections).where(eq(sections.id, ctx.sectionId)).get();

  // All assessments for this section
  const sectionAssessments = await db
    .select({
      id: assessments.id,
      title: assessments.title,
      assessmentType: assessments.assessmentType,
      maxMarks: assessments.maxMarks,
      weightage: assessments.weightage,
      date: assessments.date,
      subjectId: assessments.subjectId,
    })
    .from(assessments)
    .where(eq(assessments.sectionId, ctx.sectionId))
    .orderBy(asc(assessments.date));

  // All student's marks
  const marks = await db
    .select()
    .from(studentMarks)
    .where(eq(studentMarks.studentId, ctx.studentId));

  const marksByAssessmentId = new Map(marks.map((m) => [m.assessmentId, m]));

  // Get subjects offered in section
  const offerings = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      credits: subjects.credits,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .where(and(eq(subjectOfferings.sectionId, ctx.sectionId), eq(subjectOfferings.isActive, true)))
    .orderBy(asc(subjects.code));

  let totalScoredAll = 0;
  let totalMaxAll = 0;

  const subjectResults = offerings.map((sub) => {
    const subAssessments = sectionAssessments.filter((a) => a.subjectId === sub.id);
    let subScored = 0;
    let subMax = 0;

    const evaluationItems = subAssessments.map((a) => {
      const mark = marksByAssessmentId.get(a.id);
      const isGraded = mark !== undefined;
      const status = mark?.status ?? 'PENDING';
      const marksObtained = mark?.marksObtained ?? null;

      if (isGraded && status === 'PRESENT' && marksObtained !== null) {
        subScored += marksObtained;
        subMax += a.maxMarks;
        totalScoredAll += marksObtained;
        totalMaxAll += a.maxMarks;
      } else if (isGraded && (status === 'ABSENT' || status === 'EXEMPTED')) {
        subMax += a.maxMarks;
        totalMaxAll += a.maxMarks;
      }

      return {
        assessmentId: a.id,
        title: a.title,
        assessmentType: a.assessmentType,
        maxMarks: a.maxMarks,
        marksObtained,
        status,
        percentage: marksObtained !== null && a.maxMarks > 0 ? Number(((marksObtained / a.maxMarks) * 100).toFixed(1)) : null,
      };
    });

    const subPercentage = subMax > 0 ? Number(((subScored / subMax) * 100).toFixed(1)) : 100.0;
    const grade = calculateGrade(subPercentage);

    return {
      subjectId: sub.id,
      subjectName: sub.name,
      subjectCode: sub.code,
      credits: sub.credits ?? 3,
      totalScored: Number(subScored.toFixed(1)),
      totalMax: subMax,
      percentage: subPercentage,
      gradeLetter: grade.letter,
      gradeDescription: grade.description,
      assessments: evaluationItems,
    };
  });

  const overallPercentage = totalMaxAll > 0 ? Number(((totalScoredAll / totalMaxAll) * 100).toFixed(1)) : 100.0;
  const classification = calculateClassification(overallPercentage);

  return res.json({
    student: {
      id: student?.id,
      studentId: student?.studentId,
      fullName: student?.fullName,
      sectionName: section?.name,
    },
    overall: {
      totalMarksScored: Number(totalScoredAll.toFixed(1)),
      totalMaxMarks: totalMaxAll,
      percentage: overallPercentage,
      classification,
    },
    subjects: subjectResults,
  });
});

// ==========================================
// STUDENT LEAVE & ON-DUTY (OD) WORKFLOW
// ==========================================

const submitLeaveSchema = z.object({
  leaveType: z.enum(['MEDICAL', 'ON_DUTY_SPORTS', 'ON_DUTY_CULTURAL', 'ON_DUTY_ACADEMIC', 'PERSONAL']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  documentUrl: z.string().trim().optional(),
});

const reviewLeaveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewRemarks: z.string().trim().max(500).optional(),
});

// Student applies for Leave or On-Duty (OD)
academicRouter.post('/leave-requests', requireAuthentication, requireRole('STUDENT'), async (req, res) => {
  const parseResult = submitLeaveSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues[0]?.message ?? 'Invalid leave request data' });
  }

  const { leaveType, startDate, endDate, reason, documentUrl } = parseResult.data;
  if (startDate > endDate) {
    return res.status(400).json({ error: 'Start date cannot be after end date' });
  }

  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (!ctx.studentId) {
    return res.status(404).json({ error: 'Student profile not found for this account' });
  }

  const leaveId = randomUUID();
  const now = new Date().toISOString();

  await db.insert(leaveRequests).values({
    id: leaveId,
    institutionId: ctx.institutionId,
    studentId: ctx.studentId,
    leaveType,
    startDate,
    endDate,
    reason,
    documentUrl: documentUrl || null,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  });

  if (ctx.institutionId) {
    await db.insert(auditLogs).values({
      id: randomUUID(),
      collegeId: ctx.institutionId,
      action: 'LEAVE_REQUESTED',
      details: `Student applied for ${leaveType} from ${startDate} to ${endDate}`,
      actorUserId: req.auth!.sub,
    });
  }

  const created = await db.select().from(leaveRequests).where(eq(leaveRequests.id, leaveId)).get();
  return res.status(201).json({ leaveRequest: created });
});

// Student views their own leave & OD history
academicRouter.get('/my-leave-requests', requireAuthentication, requireRole('STUDENT'), async (req, res) => {
  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (!ctx.studentId) {
    return res.status(404).json({ error: 'Student profile not found for this account' });
  }

  const records = await db
    .select({
      id: leaveRequests.id,
      leaveType: leaveRequests.leaveType,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      reason: leaveRequests.reason,
      documentUrl: leaveRequests.documentUrl,
      status: leaveRequests.status,
      reviewRemarks: leaveRequests.reviewRemarks,
      reviewedAt: leaveRequests.reviewedAt,
      createdAt: leaveRequests.createdAt,
      reviewedByTeacherName: teachers.fullName,
    })
    .from(leaveRequests)
    .leftJoin(teachers, eq(leaveRequests.reviewedByTeacherId, teachers.id))
    .where(eq(leaveRequests.studentId, ctx.studentId))
    .orderBy(desc(leaveRequests.createdAt));

  return res.json({ leaveRequests: records });
});

// Faculty & Admin view leave & OD requests for their assigned sections
academicRouter.get('/section-leave-requests', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);
  if (!ctx.institutionId) {
    return res.json({ leaveRequests: [] });
  }

  const statusFilter = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'ALL';
  const permittedSectionIds = req.auth!.role === 'TEACHER' && ctx.sectionIds.length > 0
    ? ctx.sectionIds
    : (await sectionsForCollege(ctx.institutionId)).map((s) => s.id);

  if (permittedSectionIds.length === 0) {
    return res.json({ leaveRequests: [] });
  }

  // Get enrolled students in permitted sections
  const enrolled = await db
    .select({
      studentId: enrollments.studentId,
      sectionId: enrollments.sectionId,
      sectionName: sections.name,
    })
    .from(enrollments)
    .innerJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(and(inArray(enrollments.sectionId, permittedSectionIds), eq(enrollments.status, 'ACTIVE')));

  if (enrolled.length === 0) {
    return res.json({ leaveRequests: [] });
  }

  const studentSectionMap = new Map<string, string>();
  const studentIds: string[] = [];
  for (const e of enrolled) {
    studentSectionMap.set(e.studentId, e.sectionName);
    studentIds.push(e.studentId);
  }

  const conditions = [inArray(leaveRequests.studentId, studentIds)];
  if (statusFilter !== 'ALL' && ['PENDING', 'APPROVED', 'REJECTED'].includes(statusFilter)) {
    conditions.push(eq(leaveRequests.status, statusFilter));
  }

  const rows = await db
    .select({
      id: leaveRequests.id,
      leaveType: leaveRequests.leaveType,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      reason: leaveRequests.reason,
      documentUrl: leaveRequests.documentUrl,
      status: leaveRequests.status,
      reviewRemarks: leaveRequests.reviewRemarks,
      reviewedAt: leaveRequests.reviewedAt,
      createdAt: leaveRequests.createdAt,
      studentId: students.id,
      studentInstitutionId: students.studentId,
      studentFullName: students.fullName,
      reviewedByTeacherName: teachers.fullName,
    })
    .from(leaveRequests)
    .innerJoin(students, eq(leaveRequests.studentId, students.id))
    .leftJoin(teachers, eq(leaveRequests.reviewedByTeacherId, teachers.id))
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.createdAt));

  const enriched = rows.map((r) => ({
    ...r,
    sectionName: studentSectionMap.get(r.studentId) ?? 'Class Section',
  }));

  return res.json({ leaveRequests: enriched });
});

// Faculty & Admin review (approve or reject) a student leave or OD request
academicRouter.patch('/leave-requests/:id/review', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const leaveId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!leaveId) {
    return res.status(400).json({ error: 'Leave request ID is required' });
  }

  const parseResult = reviewLeaveSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues[0]?.message ?? 'Invalid review data' });
  }

  const { status, reviewRemarks } = parseResult.data;
  const ctx = await resolveCallerAcademicContext(req.auth!.sub, req.auth!.role, req.auth!.institutionId);

  const existing = await db.select().from(leaveRequests).where(eq(leaveRequests.id, leaveId)).get();
  if (!existing) {
    return res.status(404).json({ error: 'Leave request not found' });
  }

  const now = new Date().toISOString();
  await db
    .update(leaveRequests)
    .set({
      status,
      reviewRemarks: reviewRemarks || null,
      reviewedByTeacherId: ctx.teacherId ?? null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(leaveRequests.id, leaveId));

  if (ctx.institutionId) {
    await db.insert(auditLogs).values({
      id: randomUUID(),
      collegeId: ctx.institutionId,
      action: 'LEAVE_REVIEWED',
      details: `${req.auth!.role} marked leave request ${leaveId} as ${status}`,
      actorUserId: req.auth!.sub,
    });
  }

  const updated = await db.select().from(leaveRequests).where(eq(leaveRequests.id, leaveId)).get();
  return res.json({ leaveRequest: updated });
});



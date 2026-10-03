import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import {
  announcements,
  attendanceRecords,
  auditLogs,
  departments,
  enrollments,
  institutions,
  programs,
  sections,
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
        if (offering) {
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

  // Fallback: If institutionId was not resolved from enrollment/assignment hierarchy,
  // check fallbackInstitutionId against institutions table (by id or code)
  if (!institutionId && fallbackInstitutionId) {
    const inst = await db
      .select({ id: institutions.id })
      .from(institutions)
      .where(or(eq(institutions.id, fallbackInstitutionId), eq(institutions.code, fallbackInstitutionId)))
      .get();
    if (inst) {
      institutionId = inst.id;
    }
  }

  return {
    institutionId,
    sectionId,
    sectionName,
    departmentId,
    sectionIds: [...new Set(sectionIds)],
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
    }
  } else if (role === 'TEACHER') {
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
    if (ctx.sectionName) studentConditions.push(eq(timetableEntries.sectionName, ctx.sectionName));
    if (studentConditions.length === 0) {
      return res.json({ timetable: [] });
    }
    const filter = or(...studentConditions);
    if (filter) conditions.push(filter);
  } else if (role === 'TEACHER') {
    const teacherConditions = [];
    if (ctx.teacherId) teacherConditions.push(eq(timetableEntries.teacherId, ctx.teacherId));
    if (ctx.sectionIds.length > 0) teacherConditions.push(inArray(timetableEntries.sectionId, ctx.sectionIds));
    if (ctx.sectionNames.length > 0) teacherConditions.push(inArray(timetableEntries.sectionName, ctx.sectionNames));
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
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  period: z.coerce.number().int().min(1).max(12).default(1),
  records: z.array(
    z.object({
      studentId: z.string().trim().min(1, 'studentId is required'),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
      remarks: z.string().trim().max(250).optional(),
    })
  ).min(1, 'At least one student record is required'),
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

  const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }

  const institutionId = ctx.institutionId || req.auth!.institutionId;

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

    return res.json({
      overall: {
        totalClasses,
        attendedClasses,
        absentClasses,
        percentage,
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

  if (conditions.length === 0) {
    if (role === 'TEACHER' && ctx.sectionIds.length > 0) {
      conditions.push(inArray(attendanceRecords.sectionId, ctx.sectionIds));
    }
  }

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

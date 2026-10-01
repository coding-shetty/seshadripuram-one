import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import {
  announcements,
  auditLogs,
  departments,
  enrollments,
  institutions,
  programs,
  sections,
  students,
  subjectOfferings,
  teachers,
  teachingAssignments,
  timetableEntries,
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

academicRouter.get('/announcements', requireAuthentication, async (req, res) => {
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
    .limit(20);

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

academicRouter.get('/timetable', requireAuthentication, async (req, res) => {
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
    .limit(100);

  return res.json({ timetable: rows });
});

const postAttendanceSchema = z.object({
  sectionId: z.string().trim().optional(),
  subjectId: z.string().trim().optional(),
  date: z.string().trim().optional(),
  records: z.array(z.object({
    studentId: z.string().trim(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE']),
  })).optional(),
});

academicRouter.post('/attendance', requireAuthentication, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const result = postAttendanceSchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid request body' });
  }

  if (req.auth!.role === 'TEACHER' && result.data.sectionId) {
    const ctx = await resolveCallerAcademicContext(req.auth!.sub, 'TEACHER', req.auth!.institutionId);
    if (!ctx.sectionIds.includes(result.data.sectionId)) {
      return res.status(403).json({ error: 'You are not authorized to manage attendance for this section' });
    }
  }

  return res.status(501).json({ error: 'Attendance entry is not implemented yet' });
});

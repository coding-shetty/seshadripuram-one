import { Router } from 'express';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, departments, importJobs, programs, sections, students, teachers, users } from '../db/schema';
import { commitImport, ImportCommitError, isCommitSupported, markImportCommitted } from '../services/importCommit';
import type { ImportEntity } from '../services/importValidation';
import { z } from 'zod';
import { requireAuthentication, requireRole, requireCollege } from '../middleware/auth';
import { validateImportPreview } from '../services/importValidation';
import { sectionsForCollege } from './academic';
import { createOpaqueToken } from '../services/tokenService';

export const adminRouter = Router();

adminRouter.get('/stats', requireAuthentication, requireRole('ADMIN'), requireCollege, async (req, res) => {
  const studentsCountResult = await db.select({ count: count() }).from(students).innerJoin(users, eq(students.userId, users.id)).where(and(eq(students.isActive, true), eq(users.collegeId, req.collegeId!)));
  const activeStudents = studentsCountResult[0]?.count ?? 0;

  const teachersCountResult = await db.select({ count: count() }).from(teachers).innerJoin(users, eq(teachers.userId, users.id)).where(and(eq(teachers.isActive, true), eq(users.collegeId, req.collegeId!)));
  const facultyMembers = teachersCountResult[0]?.count ?? 0;

  const importsCountResult = await db.select({ count: count() }).from(importJobs).where(and(eq(importJobs.status, 'PREVIEWED'), eq(importJobs.collegeId, req.collegeId!)));
  const pendingImports = importsCountResult[0]?.count ?? 0;

  const activeSections = (await sectionsForCollege(req.collegeId!)).length;

  return res.json({
    stats: {
      activeStudents,
      facultyMembers,
      pendingImports,
      activeSections,
    },
  });
});

adminRouter.get('/audit-logs', requireAuthentication, requireRole('ADMIN'), requireCollege, async (req, res) => {
  const logs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      details: auditLogs.details,
      timestamp: auditLogs.timestamp,
    })
    .from(auditLogs)
    .where(eq(auditLogs.collegeId, req.collegeId!))
    .orderBy(desc(auditLogs.timestamp))
    .limit(50);

  return res.json({ logs });
});

adminRouter.get('/structure', requireAuthentication, requireRole('ADMIN'), requireCollege, async (req, res) => {
  const deptList = await db.select().from(departments).where(eq(departments.institutionId, req.collegeId!));
  const deptIds = deptList.map((department) => department.id);
  const progList = deptIds.length ? await db.select().from(programs).where(inArray(programs.departmentId, deptIds)) : [];
  const progIds = progList.map((program) => program.id);
  const sectList = progIds.length ? await db.select().from(sections).where(inArray(sections.programId, progIds)) : [];

  return res.json({
    departments: deptList,
    programs: progList,
    sections: sectList,
  });
});

const previewSchema = z.object({
  entity: z.string().trim().min(1, 'Entity is required'),
  rows: z.unknown(),
});

const jobIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Import preview ID is required'),
});

adminRouter.post('/imports/preview', requireAuthentication, requireRole('ADMIN'), requireCollege, async (req, res) => {
  const parseResult = previewSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues[0]?.message ?? 'Entity is required' });
  }
  const { entity, rows } = parseResult.data;
  const preview = await validateImportPreview(entity, rows);
  if ('error' in preview) return res.status(400).json(preview);

  const jobId = createOpaqueToken();
  await db.insert(importJobs).values({
    id: jobId,
    actorUserId: req.auth!.sub,
    collegeId: req.collegeId!,
    entity: preview.entity,
    status: 'PREVIEWED',
    totalRows: preview.totalRows,
    validRows: preview.validRows,
    invalidRows: preview.invalidRows,
    errorsJson: JSON.stringify(preview.errors),
    payloadJson: JSON.stringify(req.body.rows),
  });

  return res.status(201).json({
    importJobId: jobId,
    status: 'PREVIEWED',
    ...preview,
    message: preview.invalidRows === 0
      ? 'Preview is valid. No records were written.'
      : 'Preview contains errors. No records were written.',
  });
});

adminRouter.post('/imports/:id/commit', requireAuthentication, requireRole('ADMIN'), requireCollege, async (req, res) => {
  const paramResult = jobIdParamSchema.safeParse(req.params);
  if (!paramResult.success) return res.status(400).json({ error: 'Import preview ID is required' });
  const jobId = paramResult.data.id;

  const job = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).get();
  if (!job || job.actorUserId !== req.auth!.sub || job.collegeId !== req.collegeId!) return res.status(404).json({ error: 'Import preview not found' });
  if (job.status !== 'PREVIEWED') return res.status(409).json({ error: 'This import preview has already been processed' });
  if (job.invalidRows > 0) return res.status(422).json({ error: 'Fix all preview errors before committing the import' });
  if (!job.payloadJson) return res.status(409).json({ error: 'Import payload is unavailable; create a new preview' });
  if (!isCommitSupported(job.entity as ImportEntity)) {
    return res.status(422).json({ error: `Commit is not implemented for ${job.entity}; preview only is available` });
  }

  try {
    const rows = JSON.parse(job.payloadJson) as Record<string, unknown>[];
    const insertedRows = await db.transaction(async (tx) => {
      const claimed = await tx.update(importJobs).set({ status: 'COMMITTING' }).where(and(
        eq(importJobs.id, job.id), eq(importJobs.status, 'PREVIEWED')
      )).returning({ id: importJobs.id });
      if (!claimed.length) throw new ImportCommitError('CONFLICT', 'Import already processed');
      const count = await commitImport(tx, job.entity as ImportEntity, rows, req.collegeId!);
      await markImportCommitted(tx, job.id, req.auth!.sub, job.entity as ImportEntity, count, req.collegeId!);
      return count;
    });
    return res.json({
      importJobId: job.id,
      status: 'COMMITTED',
      insertedRows,
      transactionMode: 'ALL_OR_NOTHING',
      message: `Successfully committed ${insertedRows} ${job.entity} record(s) in an all-or-nothing transaction.`,
    });
  } catch (error) {
    let failedRow: { row: number; fields?: string[]; message: string } | undefined;
    let errorMessage = 'Import could not be committed. Create a new preview and try again.';

    if (error instanceof ImportCommitError) {
      errorMessage = error.message;
      if (error.rowNumber) {
        failedRow = { row: error.rowNumber, fields: error.fields ?? [], message: error.message };
      }
    }

    const failedErrors = failedRow ? [failedRow] : [{ row: 0, fields: [], message: errorMessage }];

    await db.update(importJobs).set({
      status: 'FAILED',
      errorsJson: JSON.stringify(failedErrors),
    }).where(and(eq(importJobs.id, job.id), eq(importJobs.status, 'PREVIEWED')));

    console.error(JSON.stringify({ event: 'academic_import_commit_failed', importJobId: job.id, actorUserId: req.auth!.sub, error: errorMessage }));

    return res.status(409).json({
      error: errorMessage,
      status: 'FAILED',
      transactionMode: 'ALL_OR_NOTHING',
      message: 'Import failed in an all-or-nothing transaction. No records were committed.',
      failedErrors,
    });
  }
});

adminRouter.get('/imports/:id', requireAuthentication, requireRole('ADMIN'), requireCollege, async (req, res) => {
  const paramResult = jobIdParamSchema.safeParse(req.params);
  if (!paramResult.success) return res.status(400).json({ error: 'Import preview ID is required' });
  const jobId = paramResult.data.id;
  const job = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).get();
  if (!job || job.actorUserId !== req.auth!.sub || job.collegeId !== req.collegeId!) return res.status(404).json({ error: 'Import preview not found' });

  return res.json({
    importJobId: job.id,
    entity: job.entity,
    status: job.status,
    totalRows: job.totalRows,
    validRows: job.validRows,
    invalidRows: job.invalidRows,
    errors: JSON.parse(job.errorsJson),
    createdAt: job.createdAt,
  });
});

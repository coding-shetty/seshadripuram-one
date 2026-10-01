import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { importJobs } from '../db/schema';
import { commitImport, ImportCommitError, isCommitSupported, markImportCommitted } from '../services/importCommit';
import type { ImportEntity } from '../services/importValidation';
import { z } from 'zod';
import { requireAuthentication, requireRole } from '../middleware/auth';
import { validateImportPreview } from '../services/importValidation';
import { createOpaqueToken } from '../services/tokenService';

export const adminRouter = Router();

const previewSchema = z.object({
  entity: z.string().trim().min(1, 'Entity is required'),
  rows: z.unknown(),
});

const jobIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Import preview ID is required'),
});

adminRouter.post('/imports/preview', requireAuthentication, requireRole('ADMIN'), async (req, res) => {
  const parseResult = previewSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues[0]?.message ?? 'Entity is required' });
  }
  const { entity, rows } = parseResult.data;
  const preview = validateImportPreview(entity, rows);
  if ('error' in preview) return res.status(400).json(preview);

  const jobId = createOpaqueToken();
  await db.insert(importJobs).values({
    id: jobId,
    actorUserId: req.auth!.sub,
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

adminRouter.post('/imports/:id/commit', requireAuthentication, requireRole('ADMIN'), async (req, res) => {
  const paramResult = jobIdParamSchema.safeParse(req.params);
  if (!paramResult.success) return res.status(400).json({ error: 'Import preview ID is required' });
  const jobId = paramResult.data.id;

  const job = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).get();
  if (!job || job.actorUserId !== req.auth!.sub) return res.status(404).json({ error: 'Import preview not found' });
  if (job.status !== 'PREVIEWED') return res.status(409).json({ error: 'This import preview has already been processed' });
  if (job.invalidRows > 0) return res.status(422).json({ error: 'Fix all preview errors before committing the import' });
  if (!job.payloadJson) return res.status(409).json({ error: 'Import payload is unavailable; create a new preview' });
  if (!isCommitSupported(job.entity as ImportEntity)) {
    return res.status(422).json({ error: `Commit is not implemented for ${job.entity}; preview only is available` });
  }

  try {
    const rows = JSON.parse(job.payloadJson) as Record<string, unknown>[];
    const insertedRows = await db.transaction(async (tx) => {
      const count = await commitImport(tx, job.entity as ImportEntity, rows);
      await markImportCommitted(tx, job.id, req.auth!.sub, job.entity as ImportEntity, count);
      return count;
    });
    return res.json({ importJobId: job.id, status: 'COMMITTED', insertedRows });
  } catch (error) {
    if (error instanceof ImportCommitError) {
      const status = error.code === 'CONFLICT' ? 409 : 422;
      return res.status(status).json({ error: error.message });
    }
    console.error(JSON.stringify({ event: 'academic_import_commit_failed', importJobId: job.id, actorUserId: req.auth!.sub }));
    return res.status(409).json({ error: 'Import could not be committed. Create a new preview and try again.' });
  }
});

adminRouter.get('/imports/:id', requireAuthentication, requireRole('ADMIN'), async (req, res) => {
  const paramResult = jobIdParamSchema.safeParse(req.params);
  if (!paramResult.success) return res.status(400).json({ error: 'Import preview ID is required' });
  const jobId = paramResult.data.id;
  const job = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).get();
  if (!job || job.actorUserId !== req.auth!.sub) return res.status(404).json({ error: 'Import preview not found' });

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

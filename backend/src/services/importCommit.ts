import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { auditLogs, importJobs, institutions, students, teachers, users } from '../db/schema';
import { isCommitSupported, type ImportEntity, type SupportedImportEntity } from './importValidation';

export { isCommitSupported };

export class ImportCommitError extends Error {
  constructor(
    public readonly code: 'UNSUPPORTED_ENTITY' | 'INVALID_PREVIEW' | 'CONFLICT',
    message: string,
    public readonly rowNumber?: number,
    public readonly fields?: string[]
  ) {
    super(message);
  }
}

type ImportRow = Record<string, unknown>;

function value(row: ImportRow, field: string): string {
  return String(row[field] ?? '').trim();
}

export async function commitImport(tx: any, entity: ImportEntity, rows: ImportRow[]): Promise<number> {
  if (!isCommitSupported(entity)) {
    throw new ImportCommitError('UNSUPPORTED_ENTITY', `Commit is not implemented for ${entity}; preview only is available`);
  }

  if (entity === 'institutions') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const code = value(row, 'code');
      const existing = await tx.select({ id: institutions.id }).from(institutions).where(eq(institutions.code, code)).get();
      if (existing) {
        throw new ImportCommitError('CONFLICT', `Institution code ${code} already exists`, i + 1, ['code']);
      }
      await tx.insert(institutions).values({
        id: randomUUID(),
        code,
        name: value(row, 'name'),
        city: value(row, 'city') || null,
      });
    }
    return rows.length;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const institutionId = value(row, entity === 'students' ? 'studentId' : 'employeeId');
    const email = value(row, 'contactEmail');
    const fullName = value(row, 'fullName');
    const userId = randomUUID();

    if (entity === 'students') {
      const existing = await tx.select({ id: students.id }).from(students).where(eq(students.studentId, institutionId)).get();
      if (existing) throw new ImportCommitError('CONFLICT', `Student ID ${institutionId} already exists`, i + 1, ['studentId']);
    } else {
      const existing = await tx.select({ id: teachers.id }).from(teachers).where(eq(teachers.employeeId, institutionId)).get();
      if (existing) throw new ImportCommitError('CONFLICT', `Employee ID ${institutionId} already exists`, i + 1, ['employeeId']);
    }

    const userExisting = await tx.select({ id: users.id }).from(users).where(eq(users.institutionId, institutionId)).get();
    if (userExisting) {
      throw new ImportCommitError('CONFLICT', `User with ID ${institutionId} already exists`, i + 1, [entity === 'students' ? 'studentId' : 'employeeId']);
    }

    await tx.insert(users).values({
      id: userId,
      role: entity === 'students' ? 'STUDENT' : 'TEACHER',
      institutionId,
      contactEmail: email,
    });

    if (entity === 'students') {
      await tx.insert(students).values({ id: randomUUID(), userId, studentId: institutionId, fullName, contactEmail: email });
    } else {
      await tx.insert(teachers).values({ id: randomUUID(), userId, employeeId: institutionId, fullName, contactEmail: email });
    }
  }
  return rows.length;
}

export async function markImportCommitted(tx: any, jobId: string, actorUserId: string, entity: ImportEntity, count: number): Promise<void> {
  await tx.update(importJobs).set({
    status: 'COMMITTED',
    payloadJson: null,
    purgedAt: new Date().toISOString(),
  }).where(and(eq(importJobs.id, jobId), eq(importJobs.actorUserId, actorUserId)));
  await tx.insert(auditLogs).values({
    id: randomUUID(),
    action: 'ACADEMIC_IMPORT_COMMITTED',
    details: JSON.stringify({ jobId, entity, rows: count, actorUserId }),
  });
}

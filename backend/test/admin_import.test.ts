import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { importJobs, institutions, students, teachers, users } from '../src/db/schema';
import { createApp } from '../src/index';
import { cleanupImportPayloads } from '../src/services/importRetention';
import { createAccessToken } from '../src/services/tokenService';

const app = createApp();
const createdUserIds: string[] = [];
const createdInstitutionCodes: string[] = [];

function createToken(userId: string, role: 'STUDENT' | 'ADMIN'): string {
  return createAccessToken({
    sub: userId,
    role,
    institutionId: `${role}-${userId}`,
  });
}

async function createUser(role: 'STUDENT' | 'ADMIN'): Promise<string> {
  const id = randomUUID();
  createdUserIds.push(id);
  await db.insert(institutions).values({ id: 'import-test-college', code: 'IMPORT-TEST', name: 'Import test college' }).onConflictDoNothing();
  await db.insert(users).values({
    id,
    role,
    institutionId: `${role}-${id}`,
    accountStatus: 'ACTIVE',
    collegeId: 'import-test-college',
  });
  return id;
}

afterEach(async () => {
  for (const code of createdInstitutionCodes.splice(0)) {
    await db.delete(institutions).where(eq(institutions.code, code));
  }
  await db.delete(students);
  await db.delete(teachers);
  for (const id of createdUserIds.splice(0)) {
    await db.delete(importJobs).where(eq(importJobs.actorUserId, id));
    await db.delete(users).where(eq(users.id, id));
  }
});

describe('admin import preview', () => {
  it('rejects non-admin users', async () => {
    const studentId = await createUser('STUDENT');
    await request(app)
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${createToken(studentId, 'STUDENT')}`)
      .send({ entity: 'departments', rows: [{ code: 'CS', name: 'Computer Science' }] })
      .expect(403);
  });

  it('commits a valid institution import exactly once', async () => {
    const adminId = await createUser('ADMIN');
    const code = `TEST-${randomUUID().slice(0, 8)}`;
    createdInstitutionCodes.push(code);
    const preview = await request(app)
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${createToken(adminId, 'ADMIN')}`)
      .send({ entity: 'institutions', rows: [{ code, name: 'Test College', city: 'Bengaluru' }] })
      .expect(201);

    const commit = await request(app)
      .post(`/api/admin/imports/${preview.body.importJobId}/commit`)
      .set('Authorization', `Bearer ${createToken(adminId, 'ADMIN')}`)
      .expect(200);

    expect(commit.body.status).toBe('COMMITTED');
    expect(commit.body.insertedRows).toBe(1);
    await request(app)
      .post(`/api/admin/imports/${preview.body.importJobId}/commit`)
      .set('Authorization', `Bearer ${createToken(adminId, 'ADMIN')}`)
      .expect(409);
    const stored = await db.select().from(institutions).where(eq(institutions.code, code));
    expect(stored).toHaveLength(1);

    const committedJob = await db.select().from(importJobs).where(eq(importJobs.id, preview.body.importJobId)).get();
    expect(committedJob?.payloadJson).toBeNull();
    expect(committedJob?.purgedAt).toBeDefined();
  });

  it('reports duplicate and missing fields without writing academic records', async () => {
    const adminId = await createUser('ADMIN');
    const response = await request(app)
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${createToken(adminId, 'ADMIN')}`)
      .send({
        entity: 'students',
        rows: [
          { studentId: '23BCA001', fullName: 'Aarav Sharma', contactEmail: 'aarav@example.com' },
          { studentId: '23BCA001', fullName: 'Aarav Duplicate', contactEmail: 'aarav2@example.com' },
          { studentId: '', fullName: 'Missing studentId', contactEmail: 'invalid@example.com' },
        ],
      })
      .expect(201);

    expect(response.body.totalRows).toBe(3);
    expect(response.body.validRows).toBe(1);
    expect(response.body.invalidRows).toBe(2);
    expect(response.body.errors).toHaveLength(2);
    expect(response.body.message).toContain('No records were written');

    const stored = await db.select().from(importJobs).where(eq(importJobs.id, response.body.importJobId));
    expect(stored).toHaveLength(1);
  });

  it('rejects unsupported entities in preview up front with a clear message', async () => {
    const adminId = await createUser('ADMIN');
    const response = await request(app)
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${createToken(adminId, 'ADMIN')}`)
      .send({
        entity: 'departments',
        rows: [{ code: 'CS', name: 'Computer Science' }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Unsupported import entity/i);
    expect(response.body.error).toContain('institutions, students, teachers');
  });

  it('checks the database in preview and reports existing record conflicts before commit', async () => {
    const adminId = await createUser('ADMIN');
    const existingCode = `COLL-${randomUUID().slice(0, 8)}`;
    createdInstitutionCodes.push(existingCode);
    await db.insert(institutions).values({
      id: randomUUID(),
      code: existingCode,
      name: 'Existing College',
    });

    const response = await request(app)
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${createToken(adminId, 'ADMIN')}`)
      .send({
        entity: 'institutions',
        rows: [
          { code: existingCode, name: 'Conflict College' },
          { code: `NEW-${randomUUID().slice(0, 8)}`, name: 'Fresh College' },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.invalidRows).toBe(1);
    expect(response.body.validRows).toBe(1);
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0].fields).toContain('code');
    expect(response.body.errors[0].message).toMatch(/already exists in the database/i);
  });

  it('marks job FAILED on commit failure, reports failed row details, and states all-or-nothing transaction', async () => {
    const adminId = await createUser('ADMIN');
    const codeA = `UNI-${randomUUID().slice(0, 8)}`;
    const codeB = `UNI-${randomUUID().slice(0, 8)}`;
    createdInstitutionCodes.push(codeA, codeB);

    // Preview 2 rows that are valid at preview time
    const preview = await request(app)
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${createToken(adminId, 'ADMIN')}`)
      .send({
        entity: 'institutions',
        rows: [
          { code: codeA, name: 'University A' },
          { code: codeB, name: 'University B' },
        ],
      })
      .expect(201);

    // Simulate an external race/conflict inserted right after preview
    await db.insert(institutions).values({
      id: randomUUID(),
      code: codeB,
      name: 'Sneaky Existing University B',
    });

    // Commit should fail, state all-or-nothing, report failed row, and mark job FAILED
    const commitRes = await request(app)
      .post(`/api/admin/imports/${preview.body.importJobId}/commit`)
      .set('Authorization', `Bearer ${createToken(adminId, 'ADMIN')}`);

    expect(commitRes.status).toBe(409);
    expect(commitRes.body.status).toBe('FAILED');
    expect(commitRes.body.transactionMode).toBe('ALL_OR_NOTHING');
    expect(commitRes.body.message).toMatch(/all-or-nothing/i);
    expect(commitRes.body.failedErrors).toBeDefined();
    expect(commitRes.body.failedErrors[0].row).toBe(2);

    // Check database to ensure job is marked FAILED and no partial rows committed
    const job = await db.select().from(importJobs).where(eq(importJobs.id, preview.body.importJobId)).get();
    expect(job?.status).toBe('FAILED');

    // Code A should NOT have been committed (all-or-nothing rolled back)
    const storedA = await db.select().from(institutions).where(eq(institutions.code, codeA)).get();
    expect(storedA).toBeUndefined();
  });

  it('purges abandoned preview payloads older than N retention days via cleanup function', async () => {
    const adminId = await createUser('ADMIN');
    const oldJobId = randomUUID();
    const freshJobId = randomUUID();

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(importJobs).values([
      {
        id: oldJobId,
        actorUserId: adminId,
        entity: 'students',
        status: 'PREVIEWED',
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        errorsJson: '[]',
        payloadJson: JSON.stringify([{ studentId: 'S-OLD', fullName: 'Old Student' }]),
        createdAt: tenDaysAgo,
      },
      {
        id: freshJobId,
        actorUserId: adminId,
        entity: 'students',
        status: 'PREVIEWED',
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        errorsJson: '[]',
        payloadJson: JSON.stringify([{ studentId: 'S-FRESH', fullName: 'Fresh Student' }]),
        createdAt: oneDayAgo,
      },
    ]);

    const result = await cleanupImportPayloads(db, { retentionDays: 7 });
    expect(result.purgedCount).toBe(1);
    expect(result.purgedJobIds).toContain(oldJobId);

    const oldJob = await db.select().from(importJobs).where(eq(importJobs.id, oldJobId)).get();
    expect(oldJob?.payloadJson).toBeNull();
    expect(oldJob?.purgedAt).toBeDefined();

    const freshJob = await db.select().from(importJobs).where(eq(importJobs.id, freshJobId)).get();
    expect(freshJob?.payloadJson).not.toBeNull();
  });
});

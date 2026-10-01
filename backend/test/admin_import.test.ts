import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { importJobs, institutions, users } from '../src/db/schema';
import { createApp } from '../src/index';
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
  await db.insert(users).values({
    id,
    role,
    institutionId: `${role}-${id}`,
    accountStatus: 'ACTIVE',
  });
  return id;
}

afterEach(async () => {
  for (const code of createdInstitutionCodes.splice(0)) {
    await db.delete(institutions).where(eq(institutions.code, code));
  }
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
});

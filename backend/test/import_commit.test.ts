import { describe, expect, it, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { auditLogs, importJobs, students, teachers, users } from '../src/db/schema';
import { commitImport, markImportCommitted, ImportCommitError } from '../src/services/importCommit';
import { assertSafeCleanup } from './helpers/cleanDb';

describe('Import Commit Service Unit Tests (src/services/importCommit.ts)', () => {
  beforeEach(async () => {
    assertSafeCleanup();
    await db.delete(auditLogs);
    await db.delete(importJobs);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);
  });

  describe('1. Unsupported Entity', () => {
    it('throws ImportCommitError with code UNSUPPORTED_ENTITY for unsupported entity', async () => {
      await expect(
        commitImport(db, 'academic_years' as any, [
          { label: '2026-2027', startDate: '2026-08-01', endDate: '2027-05-31' },
        ])
      ).rejects.toThrowError(ImportCommitError);

      try {
        await commitImport(db, 'academic_years' as any, [
          { label: '2026-2027', startDate: '2026-08-01', endDate: '2027-05-31' },
        ]);
      } catch (err: any) {
        expect(err).toBeInstanceOf(ImportCommitError);
        expect(err.code).toBe('UNSUPPORTED_ENTITY');
        expect(err.message).toContain('preview only is available');
      }
    });
  });

  describe('2. Student Import Success', () => {
    it('inserts valid student rows into users and students tables, and returns row count', async () => {
      const rows = [
        { studentId: 'STU-101', fullName: 'Alice Smith', contactEmail: 'alice@college.edu' },
        { studentId: 'STU-102', fullName: 'Bob Jones', contactEmail: 'bob@college.edu' },
      ];

      const count = await commitImport(db, 'students', rows);
      expect(count).toBe(2);

      // Verify users table
      const userRows = await db.select().from(users);
      expect(userRows).toHaveLength(2);
      expect(userRows.every((u) => u.role === 'STUDENT')).toBe(true);

      const aliceUser = userRows.find((u) => u.institutionId === 'STU-101');
      expect(aliceUser).toBeDefined();
      expect(aliceUser?.contactEmail).toBe('alice@college.edu');

      // Verify students table
      const studentRows = await db.select().from(students);
      expect(studentRows).toHaveLength(2);

      const aliceStudent = studentRows.find((s) => s.studentId === 'STU-101');
      expect(aliceStudent).toBeDefined();
      expect(aliceStudent?.fullName).toBe('Alice Smith');
      expect(aliceStudent?.userId).toBe(aliceUser?.id);
    });
  });

  describe('3. Student Import Conflicts', () => {
    it('throws ImportCommitError with code CONFLICT when studentId exists in students', async () => {
      // Pre-seed student
      const existingUserId = randomUUID();
      await db.insert(users).values({
        id: existingUserId,
        role: 'STUDENT',
        institutionId: 'STU-DUP',
        contactEmail: 'first@college.edu',
      });
      await db.insert(students).values({
        id: randomUUID(),
        userId: existingUserId,
        studentId: 'STU-DUP',
        fullName: 'First Student',
        contactEmail: 'first@college.edu',
      });

      const rows = [
        { studentId: 'STU-DUP', fullName: 'Duplicate Student', contactEmail: 'dup@college.edu' },
      ];

      try {
        await commitImport(db, 'students', rows);
        expect.fail('Expected commitImport to throw CONFLICT');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ImportCommitError);
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toContain('Student ID STU-DUP already exists');
        expect(err.fields).toEqual(['studentId']);
      }
    });

    it('throws ImportCommitError with code CONFLICT when studentId conflicts with users.institutionId', async () => {
      // Pre-seed user with same institutionId (e.g. existing user or admin)
      await db.insert(users).values({
        id: randomUUID(),
        role: 'STUDENT',
        institutionId: 'STU-USER-EXISTS',
        contactEmail: 'existing@college.edu',
      });

      const rows = [
        { studentId: 'STU-USER-EXISTS', fullName: 'Conflicting Student', contactEmail: 'new@college.edu' },
      ];

      try {
        await commitImport(db, 'students', rows);
        expect.fail('Expected commitImport to throw CONFLICT');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ImportCommitError);
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toContain('User with ID STU-USER-EXISTS already exists');
        expect(err.fields).toEqual(['studentId']);
      }
    });
  });

  describe('4. Teacher Import Success', () => {
    it('inserts valid teacher rows into users and teachers tables, and returns row count', async () => {
      const rows = [
        { employeeId: 'TCH-201', fullName: 'Dr. Carol Vance', contactEmail: 'carol@college.edu' },
        { employeeId: 'TCH-202', fullName: 'Prof. Dave Clark', contactEmail: 'dave@college.edu' },
      ];

      const count = await commitImport(db, 'teachers', rows);
      expect(count).toBe(2);

      // Verify users table
      const userRows = await db.select().from(users);
      expect(userRows).toHaveLength(2);
      expect(userRows.every((u) => u.role === 'TEACHER')).toBe(true);

      const carolUser = userRows.find((u) => u.institutionId === 'TCH-201');
      expect(carolUser).toBeDefined();

      // Verify teachers table
      const teacherRows = await db.select().from(teachers);
      expect(teacherRows).toHaveLength(2);

      const carolTeacher = teacherRows.find((t) => t.employeeId === 'TCH-201');
      expect(carolTeacher).toBeDefined();
      expect(carolTeacher?.fullName).toBe('Dr. Carol Vance');
      expect(carolTeacher?.userId).toBe(carolUser?.id);
    });
  });

  describe('5. Teacher Import Conflicts', () => {
    it('throws ImportCommitError with code CONFLICT when employeeId exists in teachers', async () => {
      const existingUserId = randomUUID();
      await db.insert(users).values({
        id: existingUserId,
        role: 'TEACHER',
        institutionId: 'TCH-DUP',
        contactEmail: 'teach1@college.edu',
      });
      await db.insert(teachers).values({
        id: randomUUID(),
        userId: existingUserId,
        employeeId: 'TCH-DUP',
        fullName: 'Existing Teacher',
        contactEmail: 'teach1@college.edu',
      });

      const rows = [
        { employeeId: 'TCH-DUP', fullName: 'Duplicate Teacher', contactEmail: 'teach2@college.edu' },
      ];

      try {
        await commitImport(db, 'teachers', rows);
        expect.fail('Expected commitImport to throw CONFLICT');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ImportCommitError);
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toContain('Employee ID TCH-DUP already exists');
        expect(err.fields).toEqual(['employeeId']);
      }
    });
  });

  describe('6. Mark Committed & PII Purge', () => {
    it('transitions job to COMMITTED, purges payloadJson, sets purgedAt, and writes audit log', async () => {
      const jobId = randomUUID();
      const actorUserId = randomUUID();

      await db.insert(users).values({
        id: actorUserId,
        role: 'ADMIN',
        institutionId: 'ADMIN-ACTOR',
        contactEmail: 'admin@college.edu',
      });

      await db.insert(importJobs).values({
        id: jobId,
        actorUserId,
        entity: 'students',
        status: 'PREVIEWED',
        totalRows: 5,
        validRows: 5,
        invalidRows: 0,
        errorsJson: '[]',
        payloadJson: JSON.stringify([{ studentId: 'S1', fullName: 'Secret Student' }]),
      });

      await markImportCommitted(db, jobId, actorUserId, 'students', 5);

      // Verify import job state
      const [updatedJob] = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
      expect(updatedJob).toBeDefined();
      expect(updatedJob?.status).toBe('COMMITTED');
      expect(updatedJob?.payloadJson).toBeNull();
      expect(updatedJob?.purgedAt).not.toBeNull();
      expect(typeof updatedJob?.purgedAt).toBe('string');

      // Verify audit log entry
      const auditEntries = await db.select().from(auditLogs);
      expect(auditEntries).toHaveLength(1);
      const entry = auditEntries[0]!;
      expect(entry.action).toBe('ACADEMIC_IMPORT_COMMITTED');

      const parsedDetails = JSON.parse(entry.details ?? '{}');
      expect(parsedDetails).toEqual({
        jobId,
        entity: 'students',
        rows: 5,
        actorUserId,
      });
    });
  });
});

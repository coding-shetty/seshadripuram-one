import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { db } from '../src/db';
import { otpSessions, users, students, authSessions, activationGrants, enrollments, teachingAssignments, timetableEntries, auditLogs, teachers } from '../src/db/schema';
import { createApp } from '../src';
import { eq } from 'drizzle-orm';
import { SmtpOtpService } from '../src/services/otpService';

describe('OTP security and verification lifecycle', () => {
  const app = createApp();
  const testInstitutionId = 'STU-OTP-SEC';

  beforeEach(async () => {
    await db.delete(authSessions);
    await db.delete(activationGrants);
    await db.delete(otpSessions);
    await db.delete(auditLogs);
    await db.delete(enrollments);
    await db.delete(teachingAssignments);
    await db.delete(timetableEntries);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(users);

    await db.insert(users).values({
      id: 'otp-user-1',
      role: 'STUDENT',
      institutionId: testInstitutionId,
      contactEmail: 'otp@college.edu',
      accountStatus: 'PRE_PROVISIONED',
    });

    await db.insert(students).values({
      id: 'student-profile-otp',
      userId: 'otp-user-1',
      studentId: testInstitutionId,
      fullName: 'OTP Test Student',
      contactEmail: 'otp@college.edu',
    });
  });

  it('immediately invalidates the OTP session when maximum attempts (5) are reached', async () => {
    const rawOtp = '123456';
    const otpHash = await bcrypt.hash(rawOtp, 10);

    await db.insert(otpSessions).values({
      institutionId: testInstitutionId,
      otpHash,
      expiresAt: Date.now() + 600000,
      attempts: 5, // maximum failed attempts reached
    });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ institutionId: testInstitutionId, otp: '000000' });

    expect(res.status).toBe(429);

    // The session MUST be deleted immediately upon reaching max attempts
    const session = await db.select().from(otpSessions).where(eq(otpSessions.institutionId, testInstitutionId)).get();
    expect(session).toBeUndefined();
  });

  it('rejects expired OTPs and deletes the expired session', async () => {
    const rawOtp = '654321';
    const otpHash = await bcrypt.hash(rawOtp, 10);

    await db.insert(otpSessions).values({
      institutionId: testInstitutionId,
      otpHash,
      expiresAt: Date.now() - 1000, // expired
      attempts: 0,
    });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ institutionId: testInstitutionId, otp: rawOtp });

    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toMatch(/expired|invalid/i);

    const session = await db.select().from(otpSessions).where(eq(otpSessions.institutionId, testInstitutionId)).get();
    expect(session).toBeUndefined();
  });

  it('enforces single-use: OTP cannot be verified twice', async () => {
    const rawOtp = '777888';
    const otpHash = await bcrypt.hash(rawOtp, 10);

    await db.insert(otpSessions).values({
      institutionId: testInstitutionId,
      otpHash,
      expiresAt: Date.now() + 600000,
      attempts: 0,
    });

    // 1st verification: succeeds
    const res1 = await request(app)
      .post('/api/auth/verify-otp')
      .send({ institutionId: testInstitutionId, otp: rawOtp });

    expect(res1.status).toBe(200);
    expect(res1.body.activationGrant).toBeDefined();

    // 2nd verification: must fail (single-use)
    const res2 = await request(app)
      .post('/api/auth/verify-otp')
      .send({ institutionId: testInstitutionId, otp: rawOtp });

    expect(res2.status).toBe(400);
  });

  it('instantiates SmtpOtpService when configured with SMTP/Gmail', () => {
    const service = new SmtpOtpService({
      host: 'smtp.gmail.com',
      port: 465,
      user: 'test@gmail.com',
      pass: 'secret-pass',
      from: 'noreply@college.edu',
      secure: true,
    });

    expect(service.generateOtp()).toMatch(/^\d{6}$/);
  });
});

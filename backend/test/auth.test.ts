import { eq } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/db";
import {
  activationGrants,
  announcements,
  auditLogs,
  authSessions,
  enrollments,
  importJobs,
  otpSessions,
  students,
  teachers,
  teachingAssignments,
  timetableEntries,
  users,
} from "../src/db/schema";
import { createApp } from "../src/index";

const app = createApp();

async function createAuthoritativeUsers() {
  await db.insert(users).values([
    { id: "student-user", institutionId: "S-001", role: "STUDENT", contactEmail: "student@example.test" },
    { id: "teacher-user", institutionId: "T-001", role: "TEACHER", contactEmail: "teacher@example.test" },
    { id: "admin-user", institutionId: "A-001", role: "ADMIN", contactEmail: "admin@example.test" },
  ]);
  await db.insert(students).values({ id: "student-profile", userId: "student-user", studentId: "S-001", fullName: "Test Student", contactEmail: "student@example.test" });
  await db.insert(teachers).values({ id: "teacher-profile", userId: "teacher-user", employeeId: "T-001", fullName: "Test Teacher", contactEmail: "teacher@example.test" });
}

async function requestOtp(institutionId: string): Promise<string> {
  const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const response = await request(app).post("/api/auth/request-activation").send({ institutionId });
  expect(response.status).toBe(202);
  const output = spy.mock.calls.map((call) => call.join(" ")).join(" ");
  spy.mockRestore();
  const otp = /otp=(\d{6})/.exec(output)?.[1];
  if (!otp) throw new Error("Expected development OTP output");
  return otp;
}

async function activate(institutionId: string) {
  const otp = await requestOtp(institutionId);
  const verification = await request(app).post("/api/auth/verify-otp").send({ institutionId, otp });
  expect(verification.status).toBe(200);
  const grant = verification.body.activationGrant as string;
  const passwordResponse = await request(app).post("/api/auth/set-password").send({ institutionId, activationGrant: grant, password: "secure-password-123" });
  expect(passwordResponse.status).toBe(204);
}

beforeEach(async () => {
  await db.delete(authSessions);
  await db.delete(activationGrants);
  await db.delete(otpSessions);
  await db.delete(auditLogs);
  await db.delete(importJobs);
  await db.delete(announcements);
  await db.delete(enrollments);
  await db.delete(teachingAssignments);
  await db.delete(timetableEntries);
  await db.delete(students);
  await db.delete(teachers);
  await db.delete(users);
  await createAuthoritativeUsers();
});

describe("authentication activation flow", () => {
  it("rejects an unknown institution ID and exposes no registration endpoint", async () => {
    await request(app).post("/api/auth/request-activation").send({ institutionId: "UNKNOWN" }).expect(404);
    await request(app).post("/api/auth/register").send({ role: "ADMIN" }).expect(404);
  });

  it("resolves authoritative student and teacher IDs without accepting a client role", async () => {
    await requestOtp("S-001");
    await requestOtp("T-001");
    const student = await db.select().from(users).where(eq(users.id, "student-user")).get();
    const teacher = await db.select().from(users).where(eq(users.id, "teacher-user")).get();
    expect(student?.role).toBe("STUDENT");
    expect(teacher?.role).toBe("TEACHER");
  });

  it("rejects invalid, expired, and reused OTPs", async () => {
    const otp = await requestOtp("S-001");
    await request(app).post("/api/auth/verify-otp").send({ institutionId: "S-001", otp: "000000" }).expect(400);
    await db.update(otpSessions).set({ expiresAt: Date.now() - 1 }).where(eq(otpSessions.institutionId, "S-001"));
    await request(app).post("/api/auth/verify-otp").send({ institutionId: "S-001", otp }).expect(400);
    const freshOtp = await requestOtp("S-001");
    await request(app).post("/api/auth/verify-otp").send({ institutionId: "S-001", otp: freshOtp }).expect(200);
    await request(app).post("/api/auth/verify-otp").send({ institutionId: "S-001", otp: freshOtp }).expect(400);
  });

  it("requires a verified activation grant and does not duplicate users", async () => {
    await request(app).post("/api/auth/set-password").send({ institutionId: "S-001", activationGrant: "not-valid", password: "secure-password-123" }).expect(401);
    await activate("S-001");
    await request(app).post("/api/auth/request-activation").send({ institutionId: "S-001" }).expect(409);
    const accounts = await db.select().from(users);
    expect(accounts.filter((account) => account.institutionId === "S-001")).toHaveLength(1);
  });

  it("issues sessions, protects /me, rejects invalid JWTs, and invalidates refresh sessions on logout", async () => {
    await activate("S-001");
    const login = await request(app).post("/api/auth/login").send({ institutionId: "S-001", password: "secure-password-123" }).expect(200);
    expect(login.body.user.role).toBe("STUDENT");
    await request(app).get("/api/auth/me").expect(401);
    await request(app).get("/api/auth/me").set("Authorization", "Bearer invalid").expect(401);
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`).expect(200);
    await request(app).post("/api/auth/logout").send({ refreshToken: login.body.refreshToken }).expect(204);
    await request(app).post("/api/auth/refresh").send({ refreshToken: login.body.refreshToken }).expect(401);
  });

  it("prevents students from reaching protected academic write routes and permits teacher access", async () => {
    await activate("S-001");
    await activate("T-001");
    const studentLogin = await request(app).post("/api/auth/login").send({ institutionId: "S-001", password: "secure-password-123" }).expect(200);
    const teacherLogin = await request(app).post("/api/auth/login").send({ institutionId: "T-001", password: "secure-password-123" }).expect(200);
    await request(app).post("/api/academic/attendance").set("Authorization", `Bearer ${studentLogin.body.accessToken}`).expect(403);
    await request(app).post("/api/academic/attendance").set("Authorization", `Bearer ${teacherLogin.body.accessToken}`).expect(501);
  });

  it("limits OTP verification attempts", async () => {
    await requestOtp("S-001");
    for (var attempt = 0; attempt < 5; attempt++) {
      await request(app).post("/api/auth/verify-otp").send({ institutionId: "S-001", otp: "000000" }).expect(400);
    }
    await request(app).post("/api/auth/verify-otp").send({ institutionId: "S-001", otp: "000000" }).expect(429);
  });

  it("keeps activation requests read-only without creating user rows or linking profiles until OTP is verified", async () => {
    await db.insert(students).values({
      id: "unlinked-student-profile",
      userId: null,
      studentId: "S-999",
      fullName: "Unlinked Student",
      contactEmail: "unlinked@example.test",
    });

    // Request activation should be read-only
    const otp = await requestOtp("S-999");

    // Assert NO user row was created and student profile was NOT mutated
    const userBeforeVerify = await db.select().from(users).where(eq(users.institutionId, "S-999")).get();
    expect(userBeforeVerify).toBeUndefined();

    const studentBeforeVerify = await db.select().from(students).where(eq(students.id, "unlinked-student-profile")).get();
    expect(studentBeforeVerify?.userId).toBeNull();

    // Now verify OTP -> only now should the user row be provisioned and linked
    const verifyRes = await request(app).post("/api/auth/verify-otp").send({ institutionId: "S-999", otp });
    expect(verifyRes.status).toBe(200);

    const userAfterVerify = await db.select().from(users).where(eq(users.institutionId, "S-999")).get();
    expect(userAfterVerify).toBeDefined();
    expect(userAfterVerify?.role).toBe("STUDENT");

    const studentAfterVerify = await db.select().from(students).where(eq(students.id, "unlinked-student-profile")).get();
    expect(studentAfterVerify?.userId).toBe(userAfterVerify?.id);
  });

  it("returns the user's real display name on /api/auth/me instead of the institution ID", async () => {
    await activate("S-001");
    const login = await request(app).post("/api/auth/login").send({ institutionId: "S-001", password: "secure-password-123" }).expect(200);

    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`).expect(200);

    expect(meRes.body.user.name).toBe("Test Student");
    expect(meRes.body.user.name).not.toBe("S-001");
  });
});

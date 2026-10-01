import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { config } from "../config";
import { db } from "../db";
import { activationGrants, auditLogs, authSessions, otpSessions, students, teachers, users } from "../db/schema";
import { requireAuthentication } from "../middleware/auth";
import { createOtpService } from "../services/otpService";
import { createAccessToken, createOpaqueToken, hashOpaqueToken, type AppRole } from "../services/tokenService";
import { logger } from "../utils/logger";

const otpService = createOtpService();
const otpExpiryMs = 10 * 60 * 1000;
const grantExpiryMs = 10 * 60 * 1000;
const refreshExpiryMs = 30 * 24 * 60 * 60 * 1000;

interface Identity {
  userId: string;
  role: AppRole;
  institutionId: string;
  name: string;
  contactEmail: string | null;
  accountStatus: string;
  isActive: boolean;
}

function validRole(value: string): value is AppRole {
  return value === "STUDENT" || value === "TEACHER" || value === "ADMIN";
}

async function audit(action: string, details: string): Promise<void> {
  await db.insert(auditLogs).values({ id: randomUUID(), action, details });
}

async function resolveIdentity(
  institutionId: string,
  options: { persist?: boolean } = {}
): Promise<Identity | null> {
  const directUser = await db.select().from(users).where(eq(users.institutionId, institutionId)).get();
  if (directUser) {
    if (!validRole(directUser.role)) return null;
    let realName = directUser.institutionId ?? "";
    if (directUser.role === "STUDENT") {
      const student = await db.select().from(students).where(eq(students.studentId, institutionId)).get();
      if (student?.fullName) realName = student.fullName;
    } else if (directUser.role === "TEACHER") {
      const teacher = await db.select().from(teachers).where(eq(teachers.employeeId, institutionId)).get();
      if (teacher?.fullName) realName = teacher.fullName;
    }
    return {
      userId: directUser.id,
      role: directUser.role,
      institutionId,
      name: realName,
      contactEmail: directUser.contactEmail,
      accountStatus: directUser.accountStatus,
      isActive: directUser.isActive,
    };
  }

  const student = await db.select().from(students).where(eq(students.studentId, institutionId)).get();
  if (student) return resolveProfileIdentity(student, "STUDENT", institutionId, options.persist ?? false);

  const teacher = await db.select().from(teachers).where(eq(teachers.employeeId, institutionId)).get();
  if (teacher) return resolveProfileIdentity(teacher, "TEACHER", institutionId, options.persist ?? false);

  return null;
}

async function resolveProfileIdentity(
  profile: { userId: string | null; fullName: string; contactEmail: string; isActive: boolean },
  role: Extract<AppRole, "STUDENT" | "TEACHER">,
  institutionId: string,
  persist: boolean,
): Promise<Identity | null> {
  let user = profile.userId
    ? await db.select().from(users).where(eq(users.id, profile.userId)).get()
    : undefined;

  if (!user && !persist) {
    return {
      userId: "",
      role,
      institutionId,
      name: profile.fullName,
      contactEmail: profile.contactEmail,
      accountStatus: "PRE_PROVISIONED",
      isActive: profile.isActive,
    };
  }

  if (!user && persist) {
    const userId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        role,
        institutionId,
        contactEmail: profile.contactEmail,
        accountStatus: "PRE_PROVISIONED",
        isActive: profile.isActive,
      });
      if (role === "STUDENT") {
        await tx.update(students).set({ userId }).where(eq(students.studentId, institutionId));
      } else {
        await tx.update(teachers).set({ userId }).where(eq(teachers.employeeId, institutionId));
      }
    });
    user = await db.select().from(users).where(eq(users.id, userId)).get();
  }
  if (!user) return null;
  return {
    userId: user.id,
    role,
    institutionId,
    name: profile.fullName,
    contactEmail: profile.contactEmail,
    accountStatus: user.accountStatus,
    isActive: profile.isActive && user.isActive,
  };
}

function publicUser(identity: Identity) {
  return { id: identity.userId, institutionId: identity.institutionId, name: identity.name, role: identity.role };
}

async function createSession(identity: Identity, familyId?: string) {
  const refreshToken = createOpaqueToken();
  const sessionFamilyId = familyId || randomUUID();
  await db.insert(authSessions).values({
    id: randomUUID(),
    userId: identity.userId,
    familyId: sessionFamilyId,
    refreshTokenHash: hashOpaqueToken(refreshToken),
    expiresAt: Date.now() + refreshExpiryMs,
  });
  return {
    accessToken: createAccessToken({ sub: identity.userId, role: identity.role, institutionId: identity.institutionId }),
    refreshToken,
    user: publicUser(identity),
  };
}

// Zod validation schemas
const requestActivationSchema = z.object({
  institutionId: z.string().trim().min(1, "Institution ID is required"),
});

const verifyOtpSchema = z.object({
  institutionId: z.string().trim().min(1, "A valid institution ID and OTP are required"),
  otp: z.string().trim().regex(/^\d{6}$/, "A valid institution ID and OTP are required"),
});

const setPasswordSchema = z.object({
  institutionId: z.string().trim().min(1, "Institution ID, activation grant, and a 12-character password are required"),
  activationGrant: z.string().trim().min(1, "Institution ID, activation grant, and a 12-character password are required"),
  password: z.string().min(12, "Institution ID, activation grant, and a 12-character password are required"),
});

const loginSchema = z.object({
  institutionId: z.string().trim().min(1, "Institution ID and password are required"),
  password: z.string().min(1, "Institution ID and password are required"),
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, "Refresh token is required"),
});

const logoutSchema = z.object({
  refreshToken: z.string().trim().optional(),
});

export interface AuthRouterOptions {
  enableRateLimits?: boolean;
}

export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const router = Router();
  const shouldSkip = () => !options.enableRateLimits && process.env.NODE_ENV === "test";

  const activationLimiter = rateLimit({
    windowMs: config.rateLimits.windowMs,
    max: config.rateLimits.activationMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const clientIp = ipKeyGenerator(req.ip ?? "127.0.0.1");
      const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId.trim().toLowerCase() : "";
      return `${clientIp}:${institutionId}`;
    },
    skip: shouldSkip,
    message: { error: "Too many activation requests. Please try again later." },
  });

  const verifyOtpLimiter = rateLimit({
    windowMs: config.rateLimits.windowMs,
    max: config.rateLimits.verifyOtpMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const clientIp = ipKeyGenerator(req.ip ?? "127.0.0.1");
      const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId.trim().toLowerCase() : "";
      return `${clientIp}:${institutionId}`;
    },
    skip: shouldSkip,
    message: { error: "Too many verification attempts. Please try again later." },
  });

  const loginAccountLimiter = rateLimit({
    windowMs: config.rateLimits.windowMs,
    max: config.rateLimits.loginAccountMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const clientIp = ipKeyGenerator(req.ip ?? "127.0.0.1");
      const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId.trim().toLowerCase() : "";
      return `${clientIp}:${institutionId}`;
    },
    skip: shouldSkip,
    message: { error: "Too many login attempts for this account. Please try again later." },
  });

  const loginIpLimiter = rateLimit({
    windowMs: config.rateLimits.windowMs,
    max: config.rateLimits.loginIpMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    message: { error: "Too many login attempts from this network. Please try again later." },
  });

  const refreshLimiter = rateLimit({
    windowMs: config.rateLimits.windowMs,
    max: config.rateLimits.refreshMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    message: { error: "Too many refresh requests. Please try again later." },
  });

  const meLimiter = rateLimit({
    windowMs: config.rateLimits.windowMs,
    max: config.rateLimits.meMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    message: { error: "Too many requests. Please try again later." },
  });

  router.post("/request-activation", activationLimiter, async (req, res) => {
    const result = requestActivationSchema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message ?? "Institution ID is required" });
    }
    const { institutionId } = result.data;

    try {
      const identity = await resolveIdentity(institutionId);
      if (!identity || !identity.isActive || !identity.contactEmail) {
        return res.status(404).json({ error: "No active account was found for this ID" });
      }
      if (identity.accountStatus === "ACTIVE") {
        return res.status(409).json({ error: "This account is already activated" });
      }

      const otp = otpService.generateOtp();
      await db.insert(otpSessions).values({
        institutionId,
        otpHash: await bcrypt.hash(otp, 12),
        expiresAt: Date.now() + otpExpiryMs,
      }).onConflictDoUpdate({
        target: otpSessions.institutionId,
        set: { otpHash: await bcrypt.hash(otp, 12), expiresAt: Date.now() + otpExpiryMs, attempts: 0 },
      });
      await otpService.sendOtp(identity.contactEmail, otp);
      await audit("ACTIVATION_REQUESTED", `Activation OTP requested for ${identity.institutionId}`);
      return res.status(202).json({ message: "An OTP was sent to the registered contact method" });
    } catch {
      return res.status(503).json({ error: "Activation is temporarily unavailable" });
    }
  });

  router.post("/verify-otp", verifyOtpLimiter, async (req, res) => {
    const result = verifyOtpSchema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message ?? "A valid institution ID and OTP are required" });
    }
    const { institutionId, otp } = result.data;

    const challenge = await db.select().from(otpSessions).where(eq(otpSessions.institutionId, institutionId)).get();
    if (!challenge || Date.now() > challenge.expiresAt) {
      if (challenge) await db.delete(otpSessions).where(eq(otpSessions.institutionId, institutionId));
      return res.status(400).json({ error: "OTP is invalid or expired" });
    }
    if (challenge.attempts >= 5) {
      await db.delete(otpSessions).where(eq(otpSessions.institutionId, institutionId));
      return res.status(429).json({ error: "Too many OTP attempts" });
    }
    if (!(await bcrypt.compare(otp, challenge.otpHash))) {
      await db.update(otpSessions).set({ attempts: challenge.attempts + 1 }).where(eq(otpSessions.institutionId, institutionId));
      return res.status(400).json({ error: "OTP is invalid or expired" });
    }

    const identity = await resolveIdentity(institutionId, { persist: true });
    if (!identity || !identity.isActive || identity.accountStatus === "ACTIVE") {
      await db.delete(otpSessions).where(eq(otpSessions.institutionId, institutionId));
      return res.status(400).json({ error: "Account is not eligible for activation" });
    }
    const activationGrant = createOpaqueToken();
    await db.transaction(async (tx) => {
      await tx.delete(otpSessions).where(eq(otpSessions.institutionId, institutionId));
      await tx.insert(activationGrants).values({
        id: randomUUID(),
        userId: identity.userId,
        tokenHash: hashOpaqueToken(activationGrant),
        expiresAt: Date.now() + grantExpiryMs,
      });
    });
    await audit("OTP_VERIFIED", `Activation OTP verified for ${identity.userId}`);
    return res.json({ activationGrant, expiresInSeconds: grantExpiryMs / 1000 });
  });

  router.post("/set-password", async (req, res) => {
    const result = setPasswordSchema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message ?? "Institution ID, activation grant, and a 12-character password are required" });
    }
    const { institutionId, activationGrant, password } = result.data;

    const identity = await resolveIdentity(institutionId);
    if (!identity || !identity.isActive) return res.status(404).json({ error: "No active account was found for this ID" });
    if (identity.accountStatus === "ACTIVE") return res.status(409).json({ error: "This account is already activated" });

    const grant = await db.select().from(activationGrants).where(and(
      eq(activationGrants.userId, identity.userId),
      eq(activationGrants.tokenHash, hashOpaqueToken(activationGrant)),
      isNull(activationGrants.usedAt),
      gt(activationGrants.expiresAt, Date.now()),
    )).get();
    if (!grant) return res.status(401).json({ error: "Activation verification is required" });

    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: await bcrypt.hash(password, 12), accountStatus: "ACTIVE" }).where(eq(users.id, identity.userId));
      await tx.update(activationGrants).set({ usedAt: Date.now() }).where(eq(activationGrants.id, grant.id));
    });
    await audit("ACTIVATION_COMPLETED", `Account activated for ${identity.userId}`);
    return res.status(204).send();
  });

  router.post("/login", loginAccountLimiter, loginIpLimiter, async (req, res) => {
    const result = loginSchema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message ?? "Institution ID and password are required" });
    }
    const { institutionId, password } = result.data;

    const identity = await resolveIdentity(institutionId);
    const user = identity ? await db.select().from(users).where(eq(users.id, identity.userId)).get() : undefined;
    if (!identity || !identity.isActive || identity.accountStatus !== "ACTIVE" || !user?.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Invalid credentials" });

    const session = await createSession(identity);
    await audit("LOGIN_SUCCESS", `Login for ${identity.userId}`);
    return res.json(session);
  });

  router.post("/refresh", refreshLimiter, async (req, res) => {
    const result = refreshSchema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message ?? "Refresh token is required" });
    }
    const { refreshToken } = result.data;

    const tokenHash = hashOpaqueToken(refreshToken);
    const session = await db.select().from(authSessions).where(eq(authSessions.refreshTokenHash, tokenHash)).get();
    if (!session) return res.status(401).json({ error: "Invalid or expired refresh token" });

    // Reuse detection: If the refresh token was already revoked, an attacker is replaying it!
    if (session.revokedAt !== null) {
      logger.warn({
        event: 'refresh_token_reuse_detected',
        userId: session.userId,
        familyId: session.familyId,
        sessionId: session.id,
      });
      // Revoke the entire session family for this user
      await db.transaction(async (tx) => {
        if (session.familyId) {
          await tx.update(authSessions).set({ revokedAt: Date.now() }).where(and(eq(authSessions.familyId, session.familyId), isNull(authSessions.revokedAt)));
        } else {
          await tx.update(authSessions).set({ revokedAt: Date.now() }).where(and(eq(authSessions.userId, session.userId), isNull(authSessions.revokedAt)));
        }
        await tx.insert(auditLogs).values({
          id: randomUUID(),
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          details: JSON.stringify({ userId: session.userId, familyId: session.familyId }),
        });
      });
      return res.status(401).json({ error: "Refresh token reuse detected. All active sessions have been revoked." });
    }

    if (Date.now() > session.expiresAt) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
    if (!user?.institutionId || !validRole(user.role) || !user.isActive || user.accountStatus !== "ACTIVE") {
      return res.status(401).json({ error: "Session is no longer valid" });
    }
    const identity = await resolveIdentity(user.institutionId);
    if (!identity) return res.status(401).json({ error: "Session is no longer valid" });

    const familyId = session.familyId || session.id;
    const newSession = await db.transaction(async (tx) => {
      await tx.update(authSessions).set({ revokedAt: Date.now() }).where(eq(authSessions.id, session.id));
      const nextRefreshToken = createOpaqueToken();
      await tx.insert(authSessions).values({
        id: randomUUID(),
        userId: identity.userId,
        familyId,
        refreshTokenHash: hashOpaqueToken(nextRefreshToken),
        expiresAt: Date.now() + refreshExpiryMs,
      });
      return {
        accessToken: createAccessToken({ sub: identity.userId, role: identity.role, institutionId: identity.institutionId }),
        refreshToken: nextRefreshToken,
        user: publicUser(identity),
      };
    });
    return res.json(newSession);
  });

  router.post("/logout", async (req, res) => {
    const result = logoutSchema.safeParse(req.body ?? {});
    if (result.success && result.data.refreshToken) {
      await db.update(authSessions).set({ revokedAt: Date.now() }).where(eq(authSessions.refreshTokenHash, hashOpaqueToken(result.data.refreshToken)));
    }
    return res.status(204).send();
  });

  router.get("/me", requireAuthentication, meLimiter, async (req, res) => {
    const user = await db.select().from(users).where(eq(users.id, req.auth!.sub)).get();
    if (!user?.institutionId || !user.isActive || user.accountStatus !== "ACTIVE" || !validRole(user.role)) {
      return res.status(401).json({ error: "Session is no longer valid" });
    }
    const identity = await resolveIdentity(user.institutionId);
    if (!identity) return res.status(401).json({ error: "Session is no longer valid" });
    return res.json({ user: publicUser(identity) });
  });

  return router;
}

export const authRouter = createAuthRouter();

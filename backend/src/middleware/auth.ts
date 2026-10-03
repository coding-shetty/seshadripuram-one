import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, students, teachers, institutions } from "../db/schema";
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AppRole, type AccessTokenClaims } from "../services/tokenService";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenClaims;
      collegeId?: string;
    }
  }
}

export async function requireAuthentication(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.auth = verifyAccessToken(header.slice("Bearer ".length));
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
    return;
  }

  // Check current server-side state on EVERY protected request. Database errors
  // propagate to Express; they must not be disguised as invalid credentials.
  const user = await db.select().from(users).where(eq(users.id, req.auth!.sub)).get();
  if (!user || !user.isActive || user.accountStatus !== "ACTIVE" || user.role !== req.auth!.role) {
    res.status(401).json({ error: "Session is no longer valid" });
    return;
  }
  const profile = user.role === "STUDENT"
    ? await db.select().from(students).where(eq(students.userId, user.id)).get()
    : user.role === "TEACHER"
      ? await db.select().from(teachers).where(eq(teachers.userId, user.id)).get()
      : undefined;
  if (profile && !profile.isActive) {
    res.status(401).json({ error: "Session is no longer valid" });
    return;
  }
  if (user.collegeId) {
    const college = await db.select().from(institutions).where(eq(institutions.id, user.collegeId)).get();
    if (!college?.isActive) {
      res.status(401).json({ error: "Session is no longer valid" });
      return;
    }
  }
  req.auth!.institutionId = user.institutionId ?? "";
  next();
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: "You are not authorized to perform this action" });
      return;
    }
    next();
  };
}

/** Explicit, current college membership is required for administrative data. */
export async function requireCollege(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = req.auth && await db.select().from(users).where(eq(users.id, req.auth.sub)).get();
  if (!user?.collegeId) {
    res.status(403).json({ error: 'College membership must be configured by the operator' });
    return;
  }
  req.collegeId = user.collegeId;
  next();
}

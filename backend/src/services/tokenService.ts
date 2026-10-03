import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";

export type AppRole = "STUDENT" | "TEACHER" | "ADMIN";

export interface AccessTokenClaims {
  sub: string;
  role: AppRole;
  institutionId: string;
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}

export function createAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: "15m",
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, config.jwtSecret, {
    algorithms: ["HS256"],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
  if (typeof decoded === "string" || typeof decoded.sub !== "string" || !decoded.sub || typeof decoded.role !== "string" || typeof decoded.institutionId !== "string" || !decoded.institutionId || typeof decoded.exp !== "number") {
    throw new Error("Invalid access token payload");
  }
  if (!["STUDENT", "TEACHER", "ADMIN"].includes(decoded.role)) {
    throw new Error("Invalid access token role");
  }
  return { sub: decoded.sub, role: decoded.role as AppRole, institutionId: decoded.institutionId };
}

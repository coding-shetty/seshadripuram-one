import { lt } from 'drizzle-orm';
import { db } from '../db';
import { authSessions, activationGrants, otpSessions } from '../db/schema';
import { logger } from '../utils/logger';

export interface CleanupResult {
  deletedSessions: number;
  deletedGrants: number;
  deletedOtps: number;
}

export async function cleanupExpiredSessions(): Promise<CleanupResult> {
  const now = Date.now();

  const sessionResult = await db.delete(authSessions).where(lt(authSessions.expiresAt, now));
  const grantResult = await db.delete(activationGrants).where(lt(activationGrants.expiresAt, now));
  const otpResult = await db.delete(otpSessions).where(lt(otpSessions.expiresAt, now));

  const deletedSessions = Number(sessionResult.rowsAffected ?? 0);
  const deletedGrants = Number(grantResult.rowsAffected ?? 0);
  const deletedOtps = Number(otpResult.rowsAffected ?? 0);

  logger.info({
    event: 'expired_sessions_cleanup',
    deletedSessions,
    deletedGrants,
    deletedOtps,
  });

  return { deletedSessions, deletedGrants, deletedOtps };
}

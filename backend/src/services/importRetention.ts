import { isNotNull, sql } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db';
import { importJobs } from '../db/schema';

export interface CleanupOptions {
  retentionDays?: number;
  now?: Date;
}

export interface CleanupResult {
  purgedCount: number;
  purgedJobIds: string[];
}

export async function cleanupImportPayloads(
  customDb: any = db,
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const retentionDays = options.retentionDays ?? config.importPayloadRetentionDays;
  const now = options.now ?? new Date();
  const cutoffTimestamp = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const candidateJobs = await customDb
    .select({ id: importJobs.id, createdAt: importJobs.createdAt, status: importJobs.status })
    .from(importJobs)
    .where(isNotNull(importJobs.payloadJson))
    .all();

  const toPurgeIds: string[] = [];

  for (const job of candidateJobs) {
    if (job.status === 'COMMITTED' || job.status === 'FAILED') {
      toPurgeIds.push(job.id);
    } else if (job.status === 'PREVIEWED') {
      const jobCreatedTime = job.createdAt ? new Date(job.createdAt).getTime() : 0;
      if (jobCreatedTime < cutoffTimestamp.getTime()) {
        toPurgeIds.push(job.id);
      }
    }
  }

  if (toPurgeIds.length === 0) {
    return { purgedCount: 0, purgedJobIds: [] };
  }

  const purgedTimestamp = now.toISOString();

  for (const id of toPurgeIds) {
    await customDb
      .update(importJobs)
      .set({
        payloadJson: null,
        purgedAt: purgedTimestamp,
      })
      .where(sql`${importJobs.id} = ${id}`);
  }

  return {
    purgedCount: toPurgeIds.length,
    purgedJobIds: toPurgeIds,
  };
}

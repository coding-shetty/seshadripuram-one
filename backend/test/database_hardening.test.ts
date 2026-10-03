import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../src/db';

describe('database hardening, indexes and transactions', () => {
  it('confirms required indexes exist on audit_logs, auth_sessions, activation_grants, and import_jobs', async () => {
    // Query sqlite_master for index names
    const result = await db.run(sql`SELECT name FROM sqlite_master WHERE type = 'index'`);
    const indexNames = (result.rows as unknown as Array<{ name: string }>).map((r) => r.name);

    expect(indexNames).toContain('import_jobs_status_idx');
    expect(indexNames).toContain('auth_sessions_expires_at_idx');
    expect(indexNames).toContain('auth_sessions_revoked_at_idx');
    expect(indexNames).toContain('activation_grants_expires_at_idx');
    expect(indexNames).toContain('audit_logs_action_idx');
    expect(indexNames).toContain('audit_logs_timestamp_idx');
  });
});

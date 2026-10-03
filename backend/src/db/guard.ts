import os from 'node:os';
import path from 'node:path';

/**
 * Hard safety guard to ensure database operations during testing never target
 * development, backup, or production databases.
 */
export function assertTestDatabaseSafe(url?: string): void {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== 'test') {
    throw new Error(
      `[DATABASE SAFETY GUARD] Test suite execution aborted: NODE_ENV must be 'test', got '${nodeEnv || ''}'.`
    );
  }

  const resolvedUrl = url ?? process.env.TURSO_DATABASE_URL;
  if (!resolvedUrl || resolvedUrl.trim() === '') {
    throw new Error(
      `[DATABASE SAFETY GUARD] Test suite execution aborted: TURSO_DATABASE_URL is empty or undefined.`
    );
  }

  const lowerUrl = resolvedUrl.toLowerCase();

  // Reject remote Turso or HTTPS databases
  if (lowerUrl.startsWith('libsql://') || lowerUrl.startsWith('https://') || lowerUrl.startsWith('http://')) {
    throw new Error(
      `[DATABASE SAFETY GUARD] Test suite execution aborted: remote database URL rejected in test mode (${resolvedUrl}).`
    );
  }

  // Reject local.db, backups, or old database references
  if (
    lowerUrl.includes('local.db') ||
    lowerUrl.includes('.bak') ||
    lowerUrl.includes('.old') ||
    lowerUrl === 'file:./local.db' ||
    lowerUrl === 'file:local.db'
  ) {
    throw new Error(
      `[DATABASE SAFETY GUARD] Test suite execution aborted: attempted to target development or backup database (${resolvedUrl}).`
    );
  }

  // Must match either: starts with file: pointing inside os.tmpdir(), or contains .test.db
  const tmpDir = os.tmpdir();
  const isInsideTmp =
    resolvedUrl.startsWith('file:') &&
    path.resolve(resolvedUrl.replace(/^file:/, '')).startsWith(path.resolve(tmpDir));
  const containsTestDb = resolvedUrl.includes('.test.db');

  if (!isInsideTmp && !containsTestDb) {
    throw new Error(
      `[DATABASE SAFETY GUARD] Test suite execution aborted: database URL (${resolvedUrl}) is not located under os.tmpdir() and does not end in .test.db.`
    );
  }
}

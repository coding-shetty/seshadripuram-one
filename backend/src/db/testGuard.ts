import os from 'node:os';
import path from 'node:path';

export function assertTestDatabase(
  url: string = process.env.TURSO_DATABASE_URL || '',
  nodeEnv: string = process.env.NODE_ENV || ''
): void {
  if (nodeEnv !== 'test') {
    throw new Error(
      `SAFETY GUARD REJECTION: Refusing to execute test database operations. NODE_ENV must be "test", received: "${nodeEnv}".`
    );
  }

  if (!url || !url.startsWith('file:')) {
    throw new Error(
      `SAFETY GUARD REJECTION: Test database URL must be a local file URI (starting with "file:"). Received: "${url}".`
    );
  }

  const rawPath = url.slice('file:'.length);
  const resolvedPath = path.resolve(rawPath);
  const tmpDir = path.resolve(os.tmpdir());

  // Explicitly deny local.db, dev.db, or any non-test database files
  const filename = path.basename(resolvedPath).toLowerCase();
  if (filename === 'local.db' || filename === 'dev.db' || filename.endsWith('local.db') || filename.endsWith('dev.db')) {
    throw new Error(
      `SAFETY GUARD REJECTION: Dangerous target detected! Test suite is pointed at non-test database: "${resolvedPath}".`
    );
  }

  const isUnderTmp = resolvedPath.startsWith(tmpDir + path.sep) || resolvedPath.startsWith(tmpDir);
  const isTestDbPattern = filename.endsWith('.test.db');

  if (!isUnderTmp && !isTestDbPattern) {
    throw new Error(
      `SAFETY GUARD REJECTION: Test database must reside under os.tmpdir() or end with ".test.db". Resolved path: "${resolvedPath}".`
    );
  }
}

import os from 'node:os';
import path from 'node:path';
import { assertTestDatabaseSafe } from '../src/db/guard';

export default function setup() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'development-test-secret-that-is-at-least-32-characters';
  process.env.OTP_PROVIDER = process.env.OTP_PROVIDER || 'console';

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_DATABASE_URL.includes('.test.db')) {
    process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), 'vitest-global.test.db')}`;
  }

  // Hard guard: abort immediately if anything points to a non-test database
  assertTestDatabaseSafe(process.env.TURSO_DATABASE_URL);
}

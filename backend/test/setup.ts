import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll } from 'vitest';
import { assertTestDatabaseSafe } from '../src/db/guard';
import { closeDatabase, setTestDatabaseUrl } from '../src/db';
import { applyTestMigrations } from './helpers/testDb';

const tempDbPath = path.join(os.tmpdir(), `seshadripuram-${randomUUID()}.test.db`);
const tempDbUrl = `file:${tempDbPath}`;

// Set env immediately so early module loads in this test file use this unique DB
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = tempDbUrl;
assertTestDatabaseSafe(tempDbUrl);

beforeAll(async () => {
  assertTestDatabaseSafe(tempDbUrl);

  // Programmatically apply real migration files from src/db/migrations
  await applyTestMigrations(tempDbUrl);

  // Point the app db proxy to this isolated, migrated DB
  setTestDatabaseUrl(tempDbUrl);
});

afterAll(async () => {
  try {
    closeDatabase();
  } catch {
    // Ignore close error
  }

  // Delete the isolated database file and SQLite journal/WAL files
  try {
    fs.rmSync(tempDbPath, { force: true });
    fs.rmSync(`${tempDbPath}-wal`, { force: true });
    fs.rmSync(`${tempDbPath}-shm`, { force: true });
    fs.rmSync(`${tempDbPath}-journal`, { force: true });
  } catch {
    // Ignore cleanup error
  }
});

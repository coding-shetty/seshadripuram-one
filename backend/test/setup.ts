import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { assertTestDatabase } from '../src/db/testGuard';
import { closeDatabase, setTestDatabaseUrl } from '../src/db';

const tempDbPath = path.join(os.tmpdir(), `seshadripuram-${randomUUID()}.test.db`);
const tempDbUrl = `file:${tempDbPath}`;

// Set env immediately so early module loads in this test file use this unique DB
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = tempDbUrl;
assertTestDatabase(tempDbUrl, 'test');

beforeAll(async () => {
  assertTestDatabase(tempDbUrl, 'test');

  // Programmatically apply real migration files from src/db/migrations
  const migratorClient = createClient({ url: tempDbUrl });
  const migratorDb = drizzle(migratorClient);
  await migrate(migratorDb, {
    migrationsFolder: path.resolve(__dirname, '../src/db/migrations'),
  });
  migratorClient.close();

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

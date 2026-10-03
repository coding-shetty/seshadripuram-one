import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { assertTestDatabaseSafe } from '../../src/db/guard';

export const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../src/db/migrations');

/**
 * Programmatically applies all Drizzle migrations to an isolated test database.
 * Enforces assertTestDatabaseSafe() before running.
 */
export async function applyTestMigrations(databaseUrl: string): Promise<void> {
  assertTestDatabaseSafe(databaseUrl);

  const client = createClient({ url: databaseUrl });
  const db = drizzle(client);

  try {
    await migrate(db, {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
  } finally {
    try {
      client.close();
    } catch {
      // Ignore close errors
    }
  }
}

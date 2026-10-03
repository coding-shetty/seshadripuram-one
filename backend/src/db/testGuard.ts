import { assertTestDatabaseSafe } from './guard';

export { assertTestDatabaseSafe };

export function assertTestDatabase(
  url: string = process.env.TURSO_DATABASE_URL || '',
  nodeEnv: string = process.env.NODE_ENV || ''
): void {
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = nodeEnv;
    assertTestDatabaseSafe(url);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
}

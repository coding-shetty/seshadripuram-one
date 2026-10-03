import { assertTestDatabase } from '../../src/db/testGuard';

/**
 * Asserts that the current runtime database target is safely confirmed to be
 * an isolated temporary test database before executing destructive DELETE statements.
 */
export function assertSafeCleanup(): void {
  assertTestDatabase();
}

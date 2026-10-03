import { describe, expect, it } from 'vitest';
import { checkMigrationDrift } from '../src/scripts/checkMigrationDrift';

describe('Database Migration Drift Check', () => {
  it('confirms schema.ts matches generated migrations with zero drift', () => {
    const result = checkMigrationDrift();
    expect(
      result.driftDetected,
      `Migration drift detected! The following new migrations were generated from uncommitted schema changes: ${result.newMigrations.join(', ')}`
    ).toBe(false);
    expect(result.newMigrations).toHaveLength(0);
  });
});

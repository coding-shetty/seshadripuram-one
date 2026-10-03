import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { assertTestDatabaseSafe } from '../src/db/guard';

describe('Test Database Safety Guard (assertTestDatabaseSafe)', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalUrl = process.env.TURSO_DATABASE_URL;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.TURSO_DATABASE_URL = originalUrl;
  });

  it('throws when NODE_ENV !== test', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertTestDatabaseSafe(`file:${path.join(os.tmpdir(), 'safe.test.db')}`)).toThrow(
      /NODE_ENV must be 'test'/i
    );

    process.env.NODE_ENV = 'production';
    expect(() => assertTestDatabaseSafe(`file:${path.join(os.tmpdir(), 'safe.test.db')}`)).toThrow(
      /NODE_ENV must be 'test'/i
    );
  });

  it('throws when URL is empty or undefined', () => {
    delete process.env.TURSO_DATABASE_URL;
    expect(() => assertTestDatabaseSafe('')).toThrow(/empty or undefined/i);
    expect(() => assertTestDatabaseSafe(undefined)).toThrow(/empty or undefined/i);
  });

  it('throws when pointed at file:./local.db, file:local.db, or contains local.db', () => {
    expect(() => assertTestDatabaseSafe('file:./local.db')).toThrow(/development or backup database/i);
    expect(() => assertTestDatabaseSafe('file:local.db')).toThrow(/development or backup database/i);
    expect(() => assertTestDatabaseSafe(`file:${path.resolve('local.db')}`)).toThrow(
      /development or backup database/i
    );
  });

  it('throws when URL contains .bak or .old', () => {
    expect(() => assertTestDatabaseSafe(`file:${path.join(os.tmpdir(), 'local.db.bak')}`)).toThrow(
      /development or backup database/i
    );
    expect(() => assertTestDatabaseSafe(`file:${path.join(os.tmpdir(), 'backup.old')}`)).toThrow(
      /development or backup database/i
    );
  });

  it('throws when pointed at remote Turso URL (libsql:// or https://)', () => {
    expect(() => assertTestDatabaseSafe('libsql://production-db.turso.io')).toThrow(
      /remote database URL rejected/i
    );
    expect(() => assertTestDatabaseSafe('https://production-db.turso.io')).toThrow(
      /remote database URL rejected/i
    );
  });

  it('throws when URL is not inside os.tmpdir() and does not contain .test.db', () => {
    expect(() => assertTestDatabaseSafe('file:./production.sqlite')).toThrow(
      /not located under os\.tmpdir\(\) and does not end in \.test\.db/i
    );
  });

  it('accepts file located inside os.tmpdir()', () => {
    const tmpUrl = `file:${path.join(os.tmpdir(), 'test-run-123.sqlite')}`;
    expect(() => assertTestDatabaseSafe(tmpUrl)).not.toThrow();
  });

  it('accepts file containing .test.db', () => {
    const testDbUrl = 'file:./random-name.test.db';
    expect(() => assertTestDatabaseSafe(testDbUrl)).not.toThrow();
  });
});

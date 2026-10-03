import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { assertTestDatabase } from '../src/db/testGuard';

describe('Test Database Safety Guard (assertTestDatabase)', () => {
  it('throws when pointed at file:./local.db', () => {
    expect(() => {
      assertTestDatabase('file:./local.db', 'test');
    }).toThrow(/Dangerous target detected.*local\.db/i);
  });

  it('throws when pointed at absolute path to local.db', () => {
    expect(() => {
      assertTestDatabase(`file:${path.resolve('local.db')}`, 'test');
    }).toThrow(/Dangerous target detected.*local\.db/i);
  });

  it('throws when pointed at file:./dev.db', () => {
    expect(() => {
      assertTestDatabase('file:./dev.db', 'test');
    }).toThrow(/Dangerous target detected.*dev\.db/i);
  });

  it('throws when NODE_ENV is not test', () => {
    const validTmpDb = `file:${path.join(os.tmpdir(), 'isolated.test.db')}`;
    expect(() => {
      assertTestDatabase(validTmpDb, 'development');
    }).toThrow(/NODE_ENV must be "test"/i);

    expect(() => {
      assertTestDatabase(validTmpDb, 'production');
    }).toThrow(/NODE_ENV must be "test"/i);
  });

  it('throws when TURSO_DATABASE_URL is not a file: URI', () => {
    expect(() => {
      assertTestDatabase('libsql://production-turso.turso.io', 'test');
    }).toThrow(/must be a local file URI/i);
  });

  it('throws when pointing to an arbitrary non-test database outside tmpdir', () => {
    expect(() => {
      assertTestDatabase('file:./app_data.sqlite', 'test');
    }).toThrow(/must reside under os\.tmpdir\(\) or end with "\.test\.db"/i);
  });

  it('accepts a database file located under os.tmpdir() when NODE_ENV is test', () => {
    const validTmpDb = `file:${path.join(os.tmpdir(), 'suite-xyz.sqlite')}`;
    expect(() => {
      assertTestDatabase(validTmpDb, 'test');
    }).not.toThrow();
  });

  it('accepts a database file ending with .test.db when NODE_ENV is test', () => {
    const validNamedDb = 'file:./isolated-suite.test.db';
    expect(() => {
      assertTestDatabase(validNamedDb, 'test');
    }).not.toThrow();
  });
});

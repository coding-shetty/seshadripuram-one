import { defineConfig } from 'vitest/config';
import os from 'node:os';
import path from 'node:path';

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'development-test-secret-that-is-at-least-32-characters',
      OTP_PROVIDER: 'console',
      TURSO_DATABASE_URL: `file:${path.join(os.tmpdir(), 'vitest-default.test.db')}`,
    },
    globalSetup: ['./test/globalSetup.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});

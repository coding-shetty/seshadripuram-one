import { describe, expect, it } from 'vitest';
import { validateConfig } from '../src/config';

describe('configuration validation', () => {
  const baseValidDevEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    JWT_SECRET: 'a-very-long-secret-key-that-has-more-than-32-characters',
    TURSO_DATABASE_URL: 'file:./local.db',
    OTP_PROVIDER: 'console',
  };

  it('validates a correct development configuration', () => {
    const config = validateConfig(baseValidDevEnv);
    expect(config.isProduction).toBe(false);
    expect(config.jwtSecret).toBe(baseValidDevEnv.JWT_SECRET);
    expect(config.port).toBe(3000);
  });

  it('refuses to boot if JWT_SECRET is less than 32 characters', () => {
    expect(() =>
      validateConfig({
        ...baseValidDevEnv,
        JWT_SECRET: 'short-secret',
      })
    ).toThrow(/JWT_SECRET must be at least 32 characters/);
  });

  it('refuses to boot in production with default test or placeholder JWT_SECRET', () => {
    expect(() =>
      validateConfig({
        ...baseValidDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'replace-with-a-long-random-secret-placeholder-here',
        TURSO_DATABASE_URL: 'libsql://production-db.turso.io',
        TURSO_AUTH_TOKEN: 'turso-prod-token',
        CORS_ORIGINS: 'https://college.edu',
        OTP_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '587',
        SMTP_USER: 'admin@college.edu',
        SMTP_PASS: 'app-password-1234',
        SMTP_FROM: 'noreply@college.edu',
      })
    ).toThrow(/insecure or placeholder/);
  });

  it('refuses to boot in production if OTP_PROVIDER is console', () => {
    expect(() =>
      validateConfig({
        ...baseValidDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'production-secret-with-high-entropy-and-over-32-chars!',
        TURSO_DATABASE_URL: 'libsql://production-db.turso.io',
        TURSO_AUTH_TOKEN: 'turso-prod-token',
        CORS_ORIGINS: 'https://college.edu',
        OTP_PROVIDER: 'console',
      })
    ).toThrow(/console OTP provider is not allowed in production/);
  });

  it('refuses to boot in production if SMTP credentials are missing when using SMTP/Gmail', () => {
    expect(() =>
      validateConfig({
        ...baseValidDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'production-secret-with-high-entropy-and-over-32-chars!',
        TURSO_DATABASE_URL: 'libsql://production-db.turso.io',
        TURSO_AUTH_TOKEN: 'turso-prod-token',
        CORS_ORIGINS: 'https://college.edu',
        OTP_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.gmail.com',
        // Missing SMTP_USER, SMTP_PASS, SMTP_FROM
      })
    ).toThrow(/SMTP/);
  });

  it('refuses to boot in production if CORS_ORIGINS is empty or wildcard *', () => {
    expect(() =>
      validateConfig({
        ...baseValidDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'production-secret-with-high-entropy-and-over-32-chars!',
        TURSO_DATABASE_URL: 'libsql://production-db.turso.io',
        TURSO_AUTH_TOKEN: 'turso-prod-token',
        CORS_ORIGINS: '*',
        OTP_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '587',
        SMTP_USER: 'admin@college.edu',
        SMTP_PASS: 'app-password-1234',
        SMTP_FROM: 'noreply@college.edu',
      })
    ).toThrow(/CORS_ORIGINS/);
  });

  it('refuses to boot in production if TURSO_DATABASE_URL is missing', () => {
    expect(() =>
      validateConfig({
        ...baseValidDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'production-secret-with-high-entropy-and-over-32-chars!',
        TURSO_DATABASE_URL: '',
        CORS_ORIGINS: 'https://college.edu',
        OTP_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '587',
        SMTP_USER: 'admin@college.edu',
        SMTP_PASS: 'app-password-1234',
        SMTP_FROM: 'noreply@college.edu',
      })
    ).toThrow(/TURSO_DATABASE_URL/);
  });

  it('validates a complete, secure production configuration with SMTP', () => {
    const parsed = validateConfig({
      NODE_ENV: 'production',
      PORT: '4000',
      JWT_SECRET: 'production-secret-with-high-entropy-and-over-32-chars!',
      TURSO_DATABASE_URL: 'libsql://production-db.turso.io',
      TURSO_AUTH_TOKEN: 'turso-prod-token',
      CORS_ORIGINS: 'https://seshadripuram.edu,https://admin.seshadripuram.edu',
      OTP_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USER: 'notifications@seshadripuram.edu',
      SMTP_PASS: 'real-app-password',
      SMTP_FROM: 'Seshadripuram One <notifications@seshadripuram.edu>',
      SMTP_SECURE: 'true',
    });

    expect(parsed.isProduction).toBe(true);
    expect(parsed.port).toBe(4000);
    expect(parsed.corsOrigins).toEqual(['https://seshadripuram.edu', 'https://admin.seshadripuram.edu']);
    expect(parsed.smtp?.host).toBe('smtp.gmail.com');
    expect(parsed.smtp?.user).toBe('notifications@seshadripuram.edu');
    expect(parsed.smtp?.secure).toBe(true);
  });
});

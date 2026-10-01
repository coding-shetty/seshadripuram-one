import 'dotenv/config';
import { z } from 'zod';

const knownInsecureSecrets = [
  'replace-with-a-long-random-secret',
  'development-test-secret-that-is-at-least-32-characters',
];

export interface AppConfig {
  port: number;
  isProduction: boolean;
  nodeEnv: 'development' | 'production' | 'test';
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  tursoDatabaseUrl: string;
  tursoAuthToken?: string | undefined;
  otpProvider: 'console' | 'resend' | 'smtp' | 'gmail' | string;
  resendApiKey: string;
  emailFrom: string;
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    secure: boolean;
  } | undefined;
  corsOrigins: string[];
  trustProxy: string;
  rateLimits: {
    activationMax: number;
    verifyOtpMax: number;
    loginAccountMax: number;
    loginIpMax: number;
    refreshMax: number;
    meMax: number;
    windowMs: number;
  };
  importPayloadRetentionDays: number;
}

export function validateConfig(rawEnv: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (rawEnv.NODE_ENV ?? 'development') as 'development' | 'production' | 'test';
  const isProduction = nodeEnv === 'production';

  const jwtSecret = rawEnv.JWT_SECRET?.trim() ?? '';
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  if (isProduction && (knownInsecureSecrets.some((s) => jwtSecret.includes(s)) || jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET uses an insecure or placeholder value in production');
  }

  const tursoDatabaseUrl = rawEnv.TURSO_DATABASE_URL?.trim() ?? '';
  if (isProduction && !tursoDatabaseUrl) {
    throw new Error('TURSO_DATABASE_URL must be configured in production');
  }

  const otpProvider = rawEnv.OTP_PROVIDER?.trim() || (isProduction ? '' : 'console');

  if (isProduction) {
    if (otpProvider === 'console') {
      throw new Error('console OTP provider is not allowed in production');
    }
    if (!otpProvider || !['resend', 'smtp', 'gmail'].includes(otpProvider)) {
      throw new Error('In production, OTP_PROVIDER must be configured with a valid email provider (smtp, gmail, or resend)');
    }
  }

  let smtpConfig: AppConfig['smtp'] | undefined;
  if (otpProvider === 'smtp' || otpProvider === 'gmail') {
    const host = rawEnv.SMTP_HOST?.trim() ?? (otpProvider === 'gmail' ? 'smtp.gmail.com' : '');
    const port = Number(rawEnv.SMTP_PORT ?? (otpProvider === 'gmail' ? 465 : 587));
    const user = rawEnv.SMTP_USER?.trim() ?? '';
    const pass = rawEnv.SMTP_PASS?.trim() ?? '';
    const from = rawEnv.SMTP_FROM?.trim() || rawEnv.EMAIL_FROM?.trim() || '';
    const secure = rawEnv.SMTP_SECURE === 'true' || port === 465;

    if (!host || !user || !pass || !from) {
      throw new Error(`SMTP configuration incomplete: SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM must be configured when OTP_PROVIDER=${otpProvider}`);
    }

    smtpConfig = { host, port, user, pass, from, secure };
  }

  const resendApiKey = rawEnv.RESEND_API_KEY?.trim() ?? '';
  const emailFrom = rawEnv.EMAIL_FROM?.trim() || rawEnv.SMTP_FROM?.trim() || '';

  if (otpProvider === 'resend') {
    if (!resendApiKey || !emailFrom) {
      throw new Error('RESEND_API_KEY and EMAIL_FROM must be configured when OTP_PROVIDER=resend');
    }
  }

  const corsOriginsRaw = rawEnv.CORS_ORIGINS?.trim() ?? '';
  const corsOrigins = corsOriginsRaw.split(',').map((o) => o.trim()).filter(Boolean);

  if (isProduction) {
    if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
      throw new Error('CORS_ORIGINS must be explicitly configured with trusted origins in production and cannot be empty or wildcard *');
    }
  }

  const port = Number(rawEnv.PORT ?? 3000);
  if (isNaN(port) || port <= 0) {
    throw new Error('PORT must be a valid positive integer');
  }

  return {
    port,
    isProduction,
    nodeEnv,
    jwtSecret,
    jwtIssuer: rawEnv.JWT_ISSUER?.trim() || 'seshadripuram-one-api',
    jwtAudience: rawEnv.JWT_AUDIENCE?.trim() || 'seshadripuram-one-app',
    tursoDatabaseUrl,
    tursoAuthToken: rawEnv.TURSO_AUTH_TOKEN?.trim(),
    otpProvider,
    resendApiKey,
    emailFrom,
    smtp: smtpConfig,
    corsOrigins,
    trustProxy: rawEnv.TRUST_PROXY?.trim() || '1',
    rateLimits: {
      activationMax: Number(rawEnv.RATE_LIMIT_ACTIVATION_MAX ?? 5),
      verifyOtpMax: Number(rawEnv.RATE_LIMIT_VERIFY_OTP_MAX ?? 5),
      loginAccountMax: Number(rawEnv.RATE_LIMIT_LOGIN_ACCOUNT_MAX ?? 10),
      loginIpMax: Number(rawEnv.RATE_LIMIT_LOGIN_IP_MAX ?? 50),
      refreshMax: Number(rawEnv.RATE_LIMIT_REFRESH_MAX ?? 100),
      meMax: Number(rawEnv.RATE_LIMIT_ME_MAX ?? 200),
      windowMs: Number(rawEnv.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    },
    importPayloadRetentionDays: Number(rawEnv.IMPORT_PAYLOAD_RETENTION_DAYS ?? 7),
  };
}

export const config = validateConfig();

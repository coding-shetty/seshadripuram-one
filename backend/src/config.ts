import 'dotenv/config';

const production = process.env.NODE_ENV === 'production';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  isProduction: production,
  jwtSecret: required('JWT_SECRET'),
  jwtIssuer: process.env.JWT_ISSUER ?? 'seshadripuram-one-api',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'seshadripuram-one-app',
  otpProvider: process.env.OTP_PROVIDER ?? '',
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
  emailFrom: process.env.EMAIL_FROM?.trim() ?? '',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY ?? '1',
  rateLimits: {
    activationMax: Number(process.env.RATE_LIMIT_ACTIVATION_MAX ?? 5),
    verifyOtpMax: Number(process.env.RATE_LIMIT_VERIFY_OTP_MAX ?? 5),
    loginAccountMax: Number(process.env.RATE_LIMIT_LOGIN_ACCOUNT_MAX ?? 10),
    loginIpMax: Number(process.env.RATE_LIMIT_LOGIN_IP_MAX ?? 50),
    refreshMax: Number(process.env.RATE_LIMIT_REFRESH_MAX ?? 100),
    meMax: Number(process.env.RATE_LIMIT_ME_MAX ?? 200),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  },
  importPayloadRetentionDays: Number(process.env.IMPORT_PAYLOAD_RETENTION_DAYS ?? 7),
};

if (config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

if (config.otpProvider === 'resend' && (!config.resendApiKey || !config.emailFrom)) {
  throw new Error('RESEND_API_KEY and EMAIL_FROM must be configured when OTP_PROVIDER=resend');
}

import nodemailer, { type Transporter } from 'nodemailer';
import { randomInt } from 'node:crypto';
import { config } from '../config';

export interface OtpService {
  generateOtp(): string;
  sendOtp(destination: string, otp: string): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure?: boolean;
}

export class SmtpOtpService implements OtpService {
  private transporter: Transporter;
  private from: string;

  constructor(smtpConfig: SmtpConfig) {
    this.from = smtpConfig.from;
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure ?? (smtpConfig.port === 465),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      requireTLS: !(smtpConfig.secure ?? (smtpConfig.port === 465)),
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });
  }

  generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  async sendOtp(destination: string, otp: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: destination,
      subject: 'Your Seshadripuram One verification code',
      text: [
        'Your Seshadripuram One verification code is:',
        '',
        otp,
        '',
        'This code expires in 10 minutes and can be used only once.',
        'If you did not request account activation, you can ignore this email.',
      ].join('\n'),
    });
  }
}

export class ConsoleOtpService implements OtpService {
  generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  async sendOtp(destination: string, otp: string): Promise<void> {
    // Available only with explicit local-development configuration.
    console.info(`[development OTP] destination=${destination} otp=${otp}`);
  }
}

export class ResendOtpService implements OtpService {
  generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  async sendOtp(destination: string, otp: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [destination],
        subject: 'Your Seshadripuram One verification code',
        text: [
          'Your Seshadripuram One verification code is:',
          '',
          otp,
          '',
          'This code expires in 10 minutes and can be used only once.',
          'If you did not request account activation, you can ignore this email.',
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      // Do not log the provider response because it may contain sensitive metadata.
      throw new Error(`Email provider rejected the OTP request with status ${response.status}`);
    }
  }
}

export class DisabledOtpService implements OtpService {
  generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  async sendOtp(): Promise<void> {
    throw new Error('No OTP provider is configured');
  }
}

export function createOtpService(activeConfig: {
  otpProvider?: string | undefined;
  isProduction?: boolean | undefined;
  smtp?: SmtpConfig | undefined;
} = config): OtpService {
  if (activeConfig.otpProvider === 'console' && !activeConfig.isProduction) return new ConsoleOtpService();
  if (activeConfig.otpProvider === 'resend') return new ResendOtpService();
  if ((activeConfig.otpProvider === 'smtp' || activeConfig.otpProvider === 'gmail') && activeConfig.smtp) {
    return new SmtpOtpService(activeConfig.smtp);
  }
  return new DisabledOtpService();
}


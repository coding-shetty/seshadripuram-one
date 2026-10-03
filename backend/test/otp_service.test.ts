import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';
import {
  ConsoleOtpService,
  DisabledOtpService,
  ResendOtpService,
  SmtpOtpService,
  createOtpService,
  type SmtpConfig,
} from '../src/services/otpService';

describe('OTP Service Unit Tests (src/services/otpService.ts)', () => {
  describe('ConsoleOtpService', () => {
    it('generateOtp returns a 6-digit string', () => {
      const service = new ConsoleOtpService();
      const otp = service.generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      const num = Number(otp);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThan(1000000);
    });

    it('sendOtp logs destination and otp to console.info', async () => {
      const service = new ConsoleOtpService();
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      try {
        await service.sendOtp('student@college.edu', '123456');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[development OTP] destination=student@college.edu otp=123456')
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('DisabledOtpService', () => {
    it('generateOtp returns a 6-digit string', () => {
      const service = new DisabledOtpService();
      expect(service.generateOtp()).toMatch(/^\d{6}$/);
    });

    it('sendOtp throws Error("No OTP provider is configured")', async () => {
      const service = new DisabledOtpService();
      await expect(service.sendOtp()).rejects.toThrow('No OTP provider is configured');
    });
  });

  describe('SmtpOtpService', () => {
    const mockSmtpConfig: SmtpConfig = {
      host: 'smtp.example.com',
      port: 587,
      user: 'mailer@example.com',
      pass: 'secretpassword',
      from: 'no-reply@seshadripuram.edu',
      secure: false,
    };

    it('sendOtp calls transporter.sendMail with expected payload and text containing OTP', async () => {
      const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg-123' });
      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: sendMailMock,
      } as any);

      const service = new SmtpOtpService(mockSmtpConfig);
      await service.sendOtp('recipient@college.edu', '654321');

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const callArgs = sendMailMock.mock.calls[0]?.[0];
      expect(callArgs.from).toBe(mockSmtpConfig.from);
      expect(callArgs.to).toBe('recipient@college.edu');
      expect(callArgs.subject).toBe('Your Seshadripuram One verification code');
      expect(callArgs.text).toContain('654321');
      expect(callArgs.text).toContain('This code expires in 10 minutes');
    });

    it('sendOtp propagates error when sendMail rejects', async () => {
      const sendMailMock = vi.fn().mockRejectedValue(new Error('SMTP connection refused'));
      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: sendMailMock,
      } as any);

      const service = new SmtpOtpService(mockSmtpConfig);
      await expect(service.sendOtp('fail@college.edu', '999888')).rejects.toThrow('SMTP connection refused');
    });
  });

  describe('ResendOtpService', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('generateOtp returns a 6-digit string', () => {
      const service = new ResendOtpService();
      expect(service.generateOtp()).toMatch(/^\d{6}$/);
    });

    it('sendOtp succeeds when fetch responds with 200 or 201', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend-123' }),
      } as any);

      const service = new ResendOtpService();
      await expect(service.sendOtp('student@college.edu', '555444')).resolves.not.toThrow();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('sendOtp throws sanitized error on provider error (status 400 or 500) without leaking API response body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"secret_internal_detail": "sensitive_leaked_token"}',
      } as any);

      const service = new ResendOtpService();
      await expect(service.sendOtp('student@college.edu', '555444')).rejects.toThrow(
        'Email provider rejected the OTP request with status 400'
      );
    });
  });

  describe('Factory & Production Security Guard (createOtpService)', () => {
    it('returns ConsoleOtpService when otpProvider is "console" and isProduction is false', () => {
      const service = createOtpService({
        otpProvider: 'console',
        isProduction: false,
      });
      expect(service).toBeInstanceOf(ConsoleOtpService);
    });

    it('CRITICAL SECURITY GUARD: returns DisabledOtpService when otpProvider is "console" and isProduction is true', () => {
      const service = createOtpService({
        otpProvider: 'console',
        isProduction: true,
      });
      expect(service).toBeInstanceOf(DisabledOtpService);
    });

    it('returns ResendOtpService when otpProvider is "resend"', () => {
      const service = createOtpService({
        otpProvider: 'resend',
        isProduction: false,
      });
      expect(service).toBeInstanceOf(ResendOtpService);
    });

    it('returns SmtpOtpService when otpProvider is "smtp" and SMTP config is provided', () => {
      const service = createOtpService({
        otpProvider: 'smtp',
        isProduction: true,
        smtp: {
          host: 'smtp.gmail.com',
          port: 465,
          user: 'admin@college.edu',
          pass: 'password',
          from: 'admin@college.edu',
          secure: true,
        },
      });
      expect(service).toBeInstanceOf(SmtpOtpService);
    });

    it('returns DisabledOtpService when no provider matches or config is missing', () => {
      expect(createOtpService({ otpProvider: 'unknown' })).toBeInstanceOf(DisabledOtpService);
      expect(createOtpService({ otpProvider: 'smtp', smtp: undefined })).toBeInstanceOf(DisabledOtpService);
      expect(createOtpService({ otpProvider: '' })).toBeInstanceOf(DisabledOtpService);
    });
  });
});

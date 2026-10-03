import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src';
import { logger } from '../src/utils/logger';

describe('structured logging and redaction', () => {
  it('redacts sensitive credentials, tokens, OTPs, passwords, and student PII', () => {
    const rawData = {
      authorization: 'Bearer secret-jwt-token-12345',
      token: 'jwt-access-token',
      refreshToken: 'refresh-token-value',
      otp: '123456',
      password: 'SuperSecretPassword!',
      email: 'student@seshadripuram.edu',
      phone: '+919876543210',
      parentPhone: '+919876543211',
      dateOfBirth: '2004-05-15',
      safeField: 'safeValue',
    };

    const sanitized = logger.sanitize(rawData);
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.refreshToken).toBe('[REDACTED]');
    expect(sanitized.otp).toBe('[REDACTED]');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.email).toBe('[REDACTED]');
    expect(sanitized.phone).toBe('[REDACTED]');
    expect(sanitized.parentPhone).toBe('[REDACTED]');
    expect(sanitized.dateOfBirth).toBe('[REDACTED]');
    expect(sanitized.safeField).toBe('safeValue');
  });

  it('attaches and propagates request ID and outputs structured JSON logs for requests', async () => {
    const logSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const app = createApp();

    const res = await request(app)
      .get('/health')
      .set('x-request-id', 'custom-trace-id-123');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('custom-trace-id-123');

    expect(logSpy).toHaveBeenCalled();
    const matchingLog = logSpy.mock.calls.find((call) => {
      const obj = call[0] as Record<string, unknown>;
      return obj && obj.requestId === 'custom-trace-id-123';
    });
    expect(matchingLog).toBeDefined();

    logSpy.mockRestore();
  });

  it('never logs request body on auth routes', async () => {
    const logSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const app = createApp();

    await request(app)
      .post('/api/auth/request-activation')
      .send({ institutionId: 'STU-9999', password: 'my-password', otp: '123456' });

    for (const call of logSpy.mock.calls) {
      const logObj = call[0] as Record<string, unknown>;
      if (logObj && logObj.url && typeof logObj.url === 'string' && logObj.url.includes('/api/auth')) {
        expect(logObj.body).toBeUndefined();
      }
    }

    logSpy.mockRestore();
  });
  it('does not record student import bodies or URL query secrets', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      await request(createApp()).post('/api/admin/imports/preview?secret=private-query')
        .send({ rows: [{ fullName: 'Private Student Name', contactEmail: 'private@example.test' }] });
      const output = JSON.stringify(warn.mock.calls);
      expect(output).not.toContain('Private Student Name');
      expect(output).not.toContain('private@example.test');
      expect(output).not.toContain('private-query');
    } finally { warn.mockRestore(); }
  });

});

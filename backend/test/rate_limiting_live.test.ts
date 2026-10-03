import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src';
import { config } from '../src/config';

describe('Live Rate Limiting Enforcement (enableRateLimits: true)', () => {
  // Fresh app instance per suite with limiters actively enabled
  const app = createApp({ enableRateLimits: true });

  describe('/request-activation limiter', () => {
    it('throttles after activationMax attempts for the same IP and institutionId', async () => {
      const targetId = 'RL-ACT-TARGET-1';

      // Send up to the limit
      for (let i = 0; i < config.rateLimits.activationMax; i++) {
        const res = await request(app)
          .post('/api/auth/request-activation')
          .send({ institutionId: targetId });
        // Should not be rate-limited (can be 404 for unknown account, but not 429)
        expect(res.status).not.toBe(429);
      }

      // Next attempt must be 429
      const throttledRes = await request(app)
        .post('/api/auth/request-activation')
        .send({ institutionId: targetId });

      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body.error).toMatch(/Too many activation requests/i);

      // A different institutionId on the same IP must NOT be blocked (composite key)
      const otherAccountRes = await request(app)
        .post('/api/auth/request-activation')
        .send({ institutionId: 'RL-ACT-DIFFERENT-ACCOUNT' });

      expect(otherAccountRes.status).not.toBe(429);
    });
  });

  describe('/verify-otp limiter', () => {
    it('throttles after verifyOtpMax attempts for the same IP and institutionId', async () => {
      const targetId = 'RL-OTP-TARGET-1';

      for (let i = 0; i < config.rateLimits.verifyOtpMax; i++) {
        const res = await request(app)
          .post('/api/auth/verify-otp')
          .send({ institutionId: targetId, otp: '123456' });
        expect(res.status).not.toBe(429);
      }

      const throttledRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ institutionId: targetId, otp: '123456' });

      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body.error).toMatch(/Too many verification attempts/i);
    });
  });

  describe('/login account and IP limiters', () => {
    it('throttles account after loginAccountMax attempts while isolating different accounts', async () => {
      const accountTarget = 'RL-LOGIN-TARGET';

      for (let i = 0; i < config.rateLimits.loginAccountMax; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ institutionId: accountTarget, password: 'WrongPassword123!' });
        expect(res.status).not.toBe(429);
      }

      // 6th attempt on target account is throttled
      const throttledRes = await request(app)
        .post('/api/auth/login')
        .send({ institutionId: accountTarget, password: 'WrongPassword123!' });

      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body.error).toMatch(/Too many login attempts for this account/i);

      // Different account on same IP is NOT blocked by account cap
      const differentAccountRes = await request(app)
        .post('/api/auth/login')
        .send({ institutionId: 'RL-LOGIN-OTHER', password: 'WrongPassword123!' });

      expect(differentAccountRes.status).not.toBe(429);
    });
  });

  describe('Independent buckets for /me and /refresh', () => {
    it('does not block /refresh or /me when login or activation attempts are exhausted', async () => {
      // /refresh is in its own bucket
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'dummy-token' });

      // Even if invalid token (401), it was NOT blocked by 429
      expect(refreshRes.status).not.toBe(429);

      // /me is in its own bucket
      const meRes = await request(app).get('/api/auth/me');
      expect(meRes.status).not.toBe(429);
    });
  });
});

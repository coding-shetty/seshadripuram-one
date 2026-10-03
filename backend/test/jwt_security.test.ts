import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src';
import { config } from '../src/config';
import { createAccessToken } from '../src/services/tokenService';

describe('JWT Security & Cryptographic Verification', () => {
  const app = createApp();

  describe('Authorization header validation', () => {
    it('rejects requests with missing Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authentication required/i);
    });

    it('rejects requests with Basic or non-Bearer authorization schemes', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authentication required/i);
    });

    it('rejects requests with empty Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authentication required|Invalid or expired/i);
    });

    it('rejects malformed non-JWT garbage tokens', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-valid-jwt-token-at-all');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid or expired access token/i);
    });
  });

  describe('Token expiration and signature tampering', () => {
    it('rejects an expired JWT even if signature is valid', async () => {
      const expiredToken = jwt.sign(
        { sub: 'usr-123', role: 'STUDENT', institutionId: 'inst-1' },
        config.jwtSecret,
        {
          algorithm: 'HS256',
          expiresIn: '-10s',
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid or expired access token/i);
    });

    it('rejects a JWT when the signature has been tampered with', async () => {
      const validToken = createAccessToken({
        sub: 'usr-student',
        role: 'STUDENT',
        institutionId: 'inst-valid',
      });

      // Tamper with the signature portion (change last 4 characters)
      const parts = validToken.split('.');
      const tamperedSignature = (parts[2] ?? '').slice(0, -4) + 'WXYZ';
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid or expired access token/i);
    });

    it('rejects a JWT signed with an attacker secret key', async () => {
      const forgedToken = jwt.sign(
        { sub: 'usr-admin-victim', role: 'ADMIN', institutionId: 'inst-victim' },
        'attacker-controlled-secret-key-that-is-at-least-32-chars-long',
        {
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid or expired access token/i);
    });

    it('rejects algorithm confusion attempts using alg: none', () => {
      // Create an unsigned token with alg: none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'usr-admin-forged',
          role: 'ADMIN',
          institutionId: 'inst-1',
          iss: config.jwtIssuer,
          aud: config.jwtAudience,
        })
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      return request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${noneToken}`)
        .expect(401)
        .then((res) => {
          expect(res.body.error).toMatch(/Invalid or expired access token/i);
        });
    });
  });

  describe('JWT payload claims validation', () => {
    it('rejects tokens missing sub claim', async () => {
      const token = jwt.sign(
        { role: 'STUDENT', institutionId: 'inst-1' },
        config.jwtSecret,
        {
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('rejects tokens missing institutionId claim', async () => {
      const token = jwt.sign(
        { sub: 'usr-1', role: 'STUDENT' },
        config.jwtSecret,
        {
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('rejects tokens containing an unrecognized or forged role value', async () => {
      const token = jwt.sign(
        { sub: 'usr-1', role: 'SUPERUSER', institutionId: 'inst-1' },
        config.jwtSecret,
        {
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('rejects tokens with wrong issuer or audience', async () => {
      const wrongIssuerToken = jwt.sign(
        { sub: 'usr-1', role: 'STUDENT', institutionId: 'inst-1' },
        config.jwtSecret,
        {
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: 'evil-issuer',
          audience: config.jwtAudience,
        }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${wrongIssuerToken}`);
      expect(res.status).toBe(401);
    });
  });
});

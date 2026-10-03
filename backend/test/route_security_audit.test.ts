import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src';

interface DiscoveredRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  middlewareStack: string[];
}

// Explicit allowlist of routes permitted to be public without authentication
const PUBLIC_ALLOWLIST = new Set([
  'GET /health',
  'GET /healthz',
  'GET /ready',
  'GET /readyz',
  'POST /api/auth/request-activation',
  'POST /api/auth/verify-otp',
  'POST /api/auth/set-password',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
]);

const KNOWN_ROOT_MIDDLEWARE = new Set([
  'helmetMiddleware',
  'requestLoggerMiddleware',
  'corsMiddleware',
  'jsonParser',
  'centralErrorHandler',
  '<anonymous>', // 404 handler
]);

const KNOWN_SUBROUTER_PREFIXES = ['/api/auth', '/api/academic', '/api/admin'];

function discoverRoutes(app: any): DiscoveredRoute[] {
  const stack = app.router?.stack ?? app._router?.stack;
  if (!Array.isArray(stack)) {
    throw new Error('FAIL CLOSED: Unable to inspect Express router stack (unrecognized app shape)');
  }

  const routes: DiscoveredRoute[] = [];

  for (const layer of stack) {
    if (!layer || typeof layer !== 'object') {
      throw new Error(`FAIL CLOSED: Unrecognized layer in router stack: ${String(layer)}`);
    }

    // Direct top-level route (e.g. /healthz, /readyz)
    if (layer.route) {
      if (typeof layer.route.path !== 'string' || !layer.route.methods || !Array.isArray(layer.route.stack)) {
        throw new Error(`FAIL CLOSED: Malformed route shape at layer: ${layer.name}`);
      }

      const methods = Object.keys(layer.route.methods) as DiscoveredRoute['method'][];
      const middlewareStack = layer.route.stack.map(
        (s: any) => s.handle?.name || s.name || 'anonymous'
      );

      for (const method of methods) {
        routes.push({
          method,
          path: layer.route.path,
          middlewareStack,
        });
      }
      continue;
    }

    // Sub-router layer (e.g. /api/auth, /api/academic, /api/admin)
    if (layer.handle?.stack) {
      if (!Array.isArray(layer.handle.stack)) {
        throw new Error(`FAIL CLOSED: Malformed sub-router stack on layer: ${layer.name}`);
      }

      let matchedPrefix: string | null = null;
      for (const prefix of KNOWN_SUBROUTER_PREFIXES) {
        if (layer.matchers && typeof layer.matchers[0] === 'function') {
          const match = layer.matchers[0](prefix + '/probe-route-audit');
          if (match) {
            matchedPrefix = prefix;
            break;
          }
        }
      }

      if (!matchedPrefix) {
        throw new Error(`FAIL CLOSED: Discovered sub-router with unrecognized prefix or matcher. Rejecting unregistered API surface.`);
      }

      for (const sub of layer.handle.stack) {
        if (!sub || typeof sub !== 'object') {
          throw new Error(`FAIL CLOSED: Malformed entry in sub-router stack for ${matchedPrefix}`);
        }

        // Internal middleware layers inside sub-router without route definition
        if (!sub.route) {
          continue;
        }

        if (typeof sub.route.path !== 'string' || !sub.route.methods || !Array.isArray(sub.route.stack)) {
          throw new Error(`FAIL CLOSED: Malformed sub-route definition in ${matchedPrefix}`);
        }

        const methods = Object.keys(sub.route.methods) as DiscoveredRoute['method'][];
        const middlewareStack = sub.route.stack.map(
          (s: any) => s.handle?.name || s.name || 'anonymous'
        );

        for (const method of methods) {
          routes.push({
            method,
            path: matchedPrefix + sub.route.path,
            middlewareStack,
          });
        }
      }
      continue;
    }

    // Known global middleware
    const layerName = layer.name || 'anonymous';
    if (KNOWN_ROOT_MIDDLEWARE.has(layerName)) {
      continue;
    }

    // If layer has an unrecognized shape or handler, FAIL CLOSED
    throw new Error(`FAIL CLOSED: Unrecognized router layer shape or unregistered root handler: "${layerName}"`);
  }

  return routes;
}

describe('Route Security Audit & Public Route Allowlist Enforcement', () => {
  const app = createApp();
  const routes = discoverRoutes(app);

  it('discovers all registered application routes successfully', () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  describe('Static middleware audit (fail closed)', () => {
    for (const route of routes) {
      const routeKey = `${route.method.toUpperCase()} ${route.path}`;
      const isPublic = PUBLIC_ALLOWLIST.has(routeKey);

      it(`verifies security policy for [${routeKey}]`, () => {
        if (isPublic) {
          // Public routes must NOT inadvertently require authentication
          expect(route.middlewareStack).not.toContain('requireAuthentication');
        } else {
          // Protected routes MUST include requireAuthentication
          expect(
            route.middlewareStack,
            `SECURITY VIOLATION: Protected route ${routeKey} is missing requireAuthentication middleware!`
          ).toContain('requireAuthentication');
        }
      });
    }
  });

  describe('Behavioural runtime check: hits every discovered route anonymously', () => {
    for (const route of routes) {
      const routeKey = `${route.method.toUpperCase()} ${route.path}`;
      const isPublic = PUBLIC_ALLOWLIST.has(routeKey);

      // Replace parameter placeholders (e.g. :id) with a test ID for behavioural invocation
      const concretePath = route.path.replace(/:[a-zA-Z0-9_]+/g, 'test-route-audit-id');

      it(`behaviourally verifies anonymous access for [${routeKey}]`, async () => {
        const req = request(app)[route.method](concretePath);

        // For POST requests, send an empty JSON object so body parsers don't stall
        if (route.method === 'post') {
          req.send({});
        }

        const res = await req;

        if (isPublic) {
          // Public endpoints should NOT reject with 401 Unauthorized
          expect(
            res.status,
            `Expected public route ${routeKey} to allow anonymous access, but got 401`
          ).not.toBe(401);
        } else {
          // Protected endpoints MUST reject anonymous requests with 401 Unauthorized
          expect(
            res.status,
            `SECURITY VIOLATION: Protected route ${routeKey} did not reject anonymous caller with 401! (status: ${res.status})`
          ).toBe(401);
          expect(res.body.error).toMatch(/Authentication required/i);
        }
      });
    }
  });
});

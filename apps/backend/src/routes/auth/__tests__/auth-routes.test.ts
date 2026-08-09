import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { authRoutes } from '../auth-routes.js';
import { errorHandler, ConflictError, UnauthorizedError } from '../../../middleware/error-handler.js';
import type { Container } from '../../../container.js';

function createMockAuthService(): {
  register: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  logoutAll: ReturnType<typeof vi.fn>;
} {
  return {
    register: vi.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: 'jane@example.com', role: 'job_seeker' },
    }),
    login: vi.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: 'jane@example.com', role: 'job_seeker' },
    }),
    refresh: vi.fn().mockResolvedValue({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }),
    logout: vi.fn().mockResolvedValue(undefined),
    logoutAll: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Auth Routes (HTTP layer)', () => {
  let app: FastifyInstance;
  let authService: ReturnType<typeof createMockAuthService>;
  let verifyAccessToken: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    authService = createMockAuthService();
    verifyAccessToken = vi.fn().mockImplementation((token: string) => {
      if (token === 'valid-token') {
        return { sub: 'user-1', email: 'jane@example.com', iat: 0, exp: 9999999999 };
      }
      // Every other token — malformed, forged, or expired — collapses to
      // null here, exactly like the real AuthProviderImpl.verifyAccessToken,
      // which catches jwt.verify()'s TokenExpiredError/JsonWebTokenError alike.
      return null;
    });

    app = Fastify();
    app.decorate('authProvider', { verifyAccessToken });
    app.decorate('container', { services: { auth: authService } } as unknown as Container);
    app.setErrorHandler(errorHandler);
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.ready();
  });

  describe('POST /register', () => {
    it('returns 201 with tokens and user on success', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'jane@example.com', password: 'p4ssw0rd!', firstName: 'Jane', lastName: 'Doe' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.accessToken).toBe('access-token');
      expect(body.refreshToken).toBe('refresh-token');
      expect(body.user.role).toBe('job_seeker');
    });

    it('returns 400 for an invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'not-an-email', password: 'p4ssw0rd!', firstName: 'Jane', lastName: 'Doe' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for a password under the 8-character minimum', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'jane@example.com', password: 'short', firstName: 'Jane', lastName: 'Doe' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when firstName/lastName are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'jane@example.com', password: 'p4ssw0rd!' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 409 when the service reports a duplicate email', async () => {
      authService.register.mockRejectedValue(new ConflictError('User with this email already exists'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'jane@example.com', password: 'p4ssw0rd!', firstName: 'Jane', lastName: 'Doe' },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('does not require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'jane@example.com', password: 'p4ssw0rd!', firstName: 'Jane', lastName: 'Doe' },
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('POST /login', () => {
    it('returns 200 with tokens on success', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'jane@example.com', password: 'p4ssw0rd!' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.user.role).toBe('job_seeker');
    });

    it('returns 400 for an invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'not-an-email', password: 'p4ssw0rd!' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 401 for wrong credentials', async () => {
      authService.login.mockRejectedValue(new UnauthorizedError('Invalid email or password'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'jane@example.com', password: 'wrong-password' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /refresh', () => {
    it('returns a new token pair on success', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 'old-refresh-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
    });

    it('returns 400 when refreshToken is missing from the body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 401 for an invalid or expired refresh token', async () => {
      authService.refresh.mockRejectedValue(new UnauthorizedError('Invalid refresh token'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 'expired-or-bogus-token' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('does not require an Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 'old-refresh-token' },
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('POST /logout', () => {
    it('revokes the given refresh token and returns success', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken: 'active-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ success: true });
      expect(authService.logout).toHaveBeenCalledWith('active-token');
    });

    it('returns 400 when refreshToken is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /logout-all', () => {
    it('returns 401 with no Authorization header', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/v1/auth/logout-all' });

      expect(response.statusCode).toBe(401);
      expect(authService.logoutAll).not.toHaveBeenCalled();
    });

    it('returns 401 for a malformed bearer token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: { authorization: 'Bearer this-is-not-a-jwt' },
      });

      expect(response.statusCode).toBe(401);
      expect(authService.logoutAll).not.toHaveBeenCalled();
    });

    it('returns 401 for an expired bearer token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: { authorization: 'Bearer expired-token' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('revokes all sessions for the authenticated user on a valid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ success: true });
      expect(authService.logoutAll).toHaveBeenCalledWith('user-1');
    });
  });
});

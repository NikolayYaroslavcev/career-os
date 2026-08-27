import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthManager } from '../../src/background/auth-manager.js';
import type { StorageBridge } from '../../src/background/storage-bridge.js';

function base64url(json: unknown): string {
  return Buffer.from(JSON.stringify(json)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildFakeJwt(exp: number): string {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({ sub: 'user-1', exp });
  return `${header}.${payload}.fake-signature`;
}

function buildStorage(): StorageBridge {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    remove: vi.fn(),
  } as unknown as StorageBridge;
}

describe('AuthManager', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('login() sets expiresAt from the JWT exp claim, not Date.parse on the raw token', async () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now
    const accessToken = buildFakeJwt(expSeconds);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accessToken, refreshToken: 'refresh-1', user: { id: 'user-1', email: 'jane@example.com' } }),
    });

    const auth = new AuthManager(buildStorage());
    await auth.login('jane@example.com', 'password');

    expect(auth.isAuthenticated()).toBe(true);
  });

  it('login() does not authenticate a token whose exp claim has already passed', async () => {
    const expSeconds = Math.floor(Date.now() / 1000) - 60; // already expired
    const accessToken = buildFakeJwt(expSeconds);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accessToken, refreshToken: 'refresh-1', user: { id: 'user-1', email: 'jane@example.com' } }),
    });

    const auth = new AuthManager(buildStorage());
    await auth.login('jane@example.com', 'password');

    expect(auth.isAuthenticated()).toBe(false);
  });

  it('login() falls back to a 15-minute default when the token cannot be decoded (never NaN/always-unauthenticated)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accessToken: 'not-a-jwt', refreshToken: 'refresh-1', user: { id: 'user-1', email: 'jane@example.com' } }),
    });

    const auth = new AuthManager(buildStorage());
    await auth.login('jane@example.com', 'password');

    expect(auth.isAuthenticated()).toBe(true);
  });

  it('refresh() (via authenticatedRequest on a 401) sets expiresAt from the new token exp claim', async () => {
    // Not expired, so ensureValidToken() doesn't proactively refresh — only
    // the 401-triggered refresh() inside authenticatedRequest should fire.
    const initialAccessToken = buildFakeJwt(Math.floor(Date.now() / 1000) + 900);
    const newExpSeconds = Math.floor(Date.now() / 1000) + 1800;
    const newAccessToken = buildFakeJwt(newExpSeconds);

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: initialAccessToken, refreshToken: 'refresh-1', user: { id: 'user-1', email: 'jane@example.com' } }),
      })
      // authenticatedRequest's first attempt: 401
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'unauthorized' })
      // refresh() call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: newAccessToken, refreshToken: 'refresh-2' }),
      })
      // authenticatedRequest's retry after refresh
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const auth = new AuthManager(buildStorage());
    await auth.login('jane@example.com', 'password');

    const result = await auth.authenticatedRequest('/api/v1/whoami');

    expect(result).toEqual({ ok: true });
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('coalesces concurrent proactive refreshes so a losing single-use-token 401 cannot log out a request that already succeeded', async () => {
    // Several feed posts detected in the same batch each call authenticatedRequest
    // around the same time; if the token is inside the proactive-refresh window,
    // each independently calling refresh() with the same refreshToken would race
    // the backend's single-use rotation — the second call gets a 401 for a token
    // the first call already consumed.
    const nearExpiry = Math.floor(Date.now() / 1000) + 30; // inside the 60s proactive-refresh window
    const initialAccessToken = buildFakeJwt(nearExpiry);
    const newAccessToken = buildFakeJwt(Math.floor(Date.now() / 1000) + 900);

    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/v1/auth/login')) {
        return {
          ok: true,
          json: async () => ({ accessToken: initialAccessToken, refreshToken: 'refresh-1', user: { id: 'user-1', email: 'jane@example.com' } }),
        };
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls++;
        if (refreshCalls > 1) {
          return { ok: false, status: 401, text: async () => 'invalid refresh token' };
        }
        return { ok: true, json: async () => ({ accessToken: newAccessToken, refreshToken: 'refresh-2' }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    const auth = new AuthManager(buildStorage());
    await auth.login('jane@example.com', 'password');

    await Promise.all([
      auth.authenticatedRequest('/api/v1/a'),
      auth.authenticatedRequest('/api/v1/b'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(auth.isAuthenticated()).toBe(true);
  });
});

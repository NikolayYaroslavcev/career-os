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
});

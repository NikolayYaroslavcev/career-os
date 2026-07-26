import type { AuthProvider, AuthConfig, TokenPayload, RefreshTokenData } from './auth-types.js';

export function createMockAuthProvider(config?: Partial<AuthConfig>): AuthProvider {
  return {
    hashPassword: vi.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$testhash'),
    verifyPassword: vi.fn().mockResolvedValue(true),
    generateAccessToken: vi.fn().mockReturnValue('mock-access-token'),
    verifyAccessToken: vi.fn().mockReturnValue({
      sub: 'test-user-id',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    } satisfies TokenPayload),
    generateRefreshToken: vi.fn().mockResolvedValue({
      id: 'refresh-token-id',
      userId: 'test-user-id',
      token: 'mock-refresh-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    } satisfies RefreshTokenData),
    verifyRefreshToken: vi.fn().mockResolvedValue(null),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
    revokeAllUserRefreshTokens: vi.fn().mockResolvedValue(undefined),
  };
}

export type MockAuthProvider = ReturnType<typeof createMockAuthProvider>;

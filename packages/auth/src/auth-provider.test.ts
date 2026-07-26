import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthProviderImpl } from './auth-provider.js';
import type { AuthConfig } from './types.js';

describe('AuthProviderImpl', () => {
  let authProvider: AuthProviderImpl;
  const config: AuthConfig = {
    jwtSecret: 'test-secret-key-at-least-32-characters-long',
    jwtAccessExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
    argon2MemoryCost: 65536,
    argon2TimeCost: 3,
    argon2Parallelism: 4,
  };

  beforeEach(() => {
    authProvider = new AuthProviderImpl(config);
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'testpassword123';
      const hash = await authProvider.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toContain('$argon2id$');
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await authProvider.hashPassword(password);
      const hash2 = await authProvider.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testpassword123';
      const hash = await authProvider.hashPassword(password);

      const isValid = await authProvider.verifyPassword(hash, password);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testpassword123';
      const hash = await authProvider.hashPassword(password);

      const isValid = await authProvider.verifyPassword(hash, 'wrongpassword');
      expect(isValid).toBe(false);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token', () => {
      const payload = { sub: 'user-id', email: 'test@example.com' };
      const token = authProvider.generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid token', () => {
      const payload = { sub: 'user-id', email: 'test@example.com' };
      const token = authProvider.generateAccessToken(payload);

      const verified = authProvider.verifyAccessToken(token);
      expect(verified).toBeDefined();
      expect(verified?.sub).toBe(payload.sub);
      expect(verified?.email).toBe(payload.email);
    });

    it('should reject invalid token', () => {
      const verified = authProvider.verifyAccessToken('invalid-token');
      expect(verified).toBeNull();
    });

    it('should reject token with wrong secret', () => {
      const wrongProvider = new AuthProviderImpl({
        ...config,
        jwtSecret: 'different-secret-key-at-least-32-characters',
      });

      const payload = { sub: 'user-id', email: 'test@example.com' };
      const token = authProvider.generateAccessToken(payload);

      const verified = wrongProvider.verifyAccessToken(token);
      expect(verified).toBeNull();
    });

    it('should reject a token signed with the "none" algorithm (algorithm confusion attack)', () => {
      // Crafted the way an attacker would: valid-looking payload, header
      // claims alg "none" so no signature is required/checked by a naive verifier.
      const forged = jwt.sign(
        { sub: 'attacker-id', email: 'attacker@example.com' },
        '',
        { algorithm: 'none' }
      );

      const verified = authProvider.verifyAccessToken(forged);
      expect(verified).toBeNull();
    });

    it('should generate tokens with the HS256 algorithm pinned in the header', () => {
      const token = authProvider.generateAccessToken({ sub: 'user-id', email: 'test@example.com' });
      const decodedHeader = jwt.decode(token, { complete: true })?.header;

      expect(decodedHeader?.alg).toBe('HS256');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token', async () => {
      const userId = 'user-id';
      const refreshToken = await authProvider.generateRefreshToken(userId);

      expect(refreshToken).toBeDefined();
      expect(refreshToken.id).toBeDefined();
      expect(refreshToken.userId).toBe(userId);
      expect(refreshToken.token).toBeDefined();
      expect(refreshToken.expiresAt).toBeInstanceOf(Date);
      expect(refreshToken.createdAt).toBeInstanceOf(Date);
      expect(refreshToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});

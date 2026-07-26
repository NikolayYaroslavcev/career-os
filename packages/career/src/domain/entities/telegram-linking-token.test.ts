import { describe, it, expect } from 'vitest';
import { TelegramLinkingToken } from './telegram-linking-token.js';
import { createUserId, createTelegramLinkingTokenId } from '../base/identifier.js';

describe('TelegramLinkingToken', () => {
  const userId = createUserId('user-1');
  const tokenId = createTelegramLinkingTokenId('token-1');

  function buildToken(overrides?: { expiresAt?: Date; createdAt?: Date }): TelegramLinkingToken {
    return TelegramLinkingToken.create({
      id: tokenId,
      userId,
      tokenHash: 'hash-abc',
      expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000),
      createdAt: overrides?.createdAt,
    });
  }

  it('creates a token that is valid, unused, and unexpired', () => {
    const token = buildToken();

    expect(token.id).toBe(tokenId);
    expect(token.userId).toBe(userId);
    expect(token.tokenHash).toBe('hash-abc');
    expect(token.isUsed()).toBe(false);
    expect(token.isExpired()).toBe(false);
    expect(token.isValid()).toBe(true);
    expect(token.usedAt).toBeUndefined();
  });

  it('treats a token as expired once the clock passes expiresAt', () => {
    const expiresAt = new Date(Date.now() - 1000);
    const token = buildToken({ expiresAt });

    expect(token.isExpired()).toBe(true);
    expect(token.isValid()).toBe(false);
  });

  it('treats a token exactly at its expiry instant as expired', () => {
    const expiresAt = new Date(Date.now() + 1000);
    const token = buildToken({ expiresAt });

    expect(token.isExpired(expiresAt)).toBe(true);
  });

  it('marks a valid token as used, recording usedAt', () => {
    const token = buildToken();
    const now = new Date();

    token.markUsed(now);

    expect(token.isUsed()).toBe(true);
    expect(token.usedAt).toEqual(now);
    expect(token.isValid()).toBe(false);
  });

  it('rejects reusing an already-used token (single-use enforcement)', () => {
    const token = buildToken();
    token.markUsed();

    expect(() => token.markUsed()).toThrow('Linking token has already been used');
  });

  it('rejects marking an expired token as used', () => {
    const token = buildToken({ expiresAt: new Date(Date.now() - 1000) });

    expect(() => token.markUsed()).toThrow('Linking token has expired');
  });
});

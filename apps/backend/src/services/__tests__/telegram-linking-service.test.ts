import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NoopMetricsCollector, NoopLogger } from '@careeros/providers';
import {
  InMemoryUserRepository,
  InMemoryTelegramConnectionRepository,
  InMemoryTelegramLinkingTokenRepository,
} from '../../testing/in-memory-repositories.js';
import { buildFixtureUser, FIXTURE_USER_ID } from '../../testing/fixtures.js';
import { createUserId, User, Email } from '@careeros/career';
import {
  TelegramLinkingService,
  UserNotFoundError,
  InvalidLinkingCodeError,
  ExpiredLinkingCodeError,
  TelegramAccountAlreadyLinkedError,
} from '../telegram-linking-service.js';
import { hashLinkingCode } from '../telegram-linking-code.js';

const CHAT_ID = 'chat-123';

describe('TelegramLinkingService', () => {
  let userRepository: InMemoryUserRepository;
  let connectionRepository: InMemoryTelegramConnectionRepository;
  let tokenRepository: InMemoryTelegramLinkingTokenRepository;
  let service: TelegramLinkingService;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    connectionRepository = new InMemoryTelegramConnectionRepository();
    tokenRepository = new InMemoryTelegramLinkingTokenRepository();
    service = new TelegramLinkingService(
      userRepository,
      connectionRepository,
      tokenRepository,
      new NoopMetricsCollector(),
      new NoopLogger()
    );
    await userRepository.save(buildFixtureUser());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateLinkingCode (token generation)', () => {
    it('generates a code with a hash that can be looked up, and an expiry 5 minutes out', async () => {
      const before = Date.now();
      const result = await service.generateLinkingCode(FIXTURE_USER_ID);
      const after = Date.now();

      expect(result.code).toMatch(/^[A-Z0-9]{8}$/);
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 5 * 60 * 1000);

      const stored = await tokenRepository.findByTokenHash(hashLinkingCode(result.code));
      expect(stored).not.toBeNull();
      expect(stored?.userId).toBe(FIXTURE_USER_ID);
    });

    it('generates a different code (securely random) on each call', async () => {
      const first = await service.generateLinkingCode(FIXTURE_USER_ID);
      const second = await service.generateLinkingCode(FIXTURE_USER_ID);

      expect(first.code).not.toBe(second.code);
    });

    it('rejects generating a code for a user that does not exist', async () => {
      await expect(service.generateLinkingCode(createUserId('missing-user'))).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('token expiration', () => {
    it('rejects an expired code with ExpiredLinkingCodeError', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const { code } = await service.generateLinkingCode(FIXTURE_USER_ID);

      vi.setSystemTime(new Date('2026-01-01T00:05:00.001Z')); // 1ms past the 5-minute TTL

      await expect(service.linkAccount({ code, telegramChatId: CHAT_ID })).rejects.toThrow(ExpiredLinkingCodeError);
    });

    it('accepts a code redeemed just before expiry', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const { code } = await service.generateLinkingCode(FIXTURE_USER_ID);

      vi.setSystemTime(new Date('2026-01-01T00:04:59.999Z'));

      await expect(service.linkAccount({ code, telegramChatId: CHAT_ID })).resolves.toBeDefined();
    });
  });

  describe('successful linking flow', () => {
    it('links the account and persists an active TelegramConnection', async () => {
      const { code } = await service.generateLinkingCode(FIXTURE_USER_ID);

      const connection = await service.linkAccount({ code, telegramChatId: CHAT_ID, telegramUsername: 'jdoe' });

      expect(connection.userId).toBe(FIXTURE_USER_ID);
      expect(connection.telegramChatId).toBe(CHAT_ID);
      expect(connection.telegramUsername).toBe('jdoe');
      expect(connection.isActive).toBe(true);

      const stored = await connectionRepository.findByUserId(FIXTURE_USER_ID);
      expect(stored?.id).toBe(connection.id);
    });

    it('handleLinkCommand (bot entry point) returns a success message', async () => {
      const { code } = await service.generateLinkingCode(FIXTURE_USER_ID);

      const result = await service.handleLinkCommand({ code, telegramChatId: CHAT_ID });

      expect(result.success).toBe(true);
    });
  });

  describe('invalid token flow', () => {
    it('rejects a code that was never generated', async () => {
      await expect(service.linkAccount({ code: 'NOTREAL1', telegramChatId: CHAT_ID })).rejects.toThrow(
        InvalidLinkingCodeError
      );
    });

    it('rejects reusing an already-redeemed code (single-use enforcement)', async () => {
      const { code } = await service.generateLinkingCode(FIXTURE_USER_ID);
      await service.linkAccount({ code, telegramChatId: CHAT_ID });

      await expect(service.linkAccount({ code, telegramChatId: 'chat-456' })).rejects.toThrow(InvalidLinkingCodeError);
    });

    it('handleLinkCommand relays a friendly message instead of throwing for an invalid code', async () => {
      const result = await service.handleLinkCommand({ code: 'NOTREAL1', telegramChatId: CHAT_ID });

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining('invalid'),
      });
    });
  });

  describe('duplicate account flow', () => {
    it('rejects linking a Telegram chat that is already linked to a different user', async () => {
      const otherUserId = createUserId('22222222-2222-4222-8222-222222222222');
      await userRepository.save(
        User.create({
          id: otherUserId,
          email: Email.create('other@careeros.local'),
          firstName: 'Other',
          lastName: 'User',
        })
      );

      const firstCode = await service.generateLinkingCode(FIXTURE_USER_ID);
      await service.linkAccount({ code: firstCode.code, telegramChatId: CHAT_ID });

      const secondCode = await service.generateLinkingCode(otherUserId);
      await expect(service.linkAccount({ code: secondCode.code, telegramChatId: CHAT_ID })).rejects.toThrow(
        TelegramAccountAlreadyLinkedError
      );
    });

    it('allows the same user to re-link (relink to a new chat updates the existing connection)', async () => {
      const first = await service.generateLinkingCode(FIXTURE_USER_ID);
      const original = await service.linkAccount({ code: first.code, telegramChatId: CHAT_ID });

      const second = await service.generateLinkingCode(FIXTURE_USER_ID);
      const relinked = await service.linkAccount({ code: second.code, telegramChatId: 'chat-999' });

      expect(relinked.id).toBe(original.id);
      expect(relinked.telegramChatId).toBe('chat-999');

      const all = await connectionRepository.findByUserId(FIXTURE_USER_ID);
      expect(all?.telegramChatId).toBe('chat-999');
    });
  });
});

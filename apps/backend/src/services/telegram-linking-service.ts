import { randomUUID } from 'node:crypto';
import {
  createUserId,
  createTelegramConnectionId,
  createTelegramLinkingTokenId,
  TelegramConnection,
  TelegramLinkingToken,
} from '@careeros/career';
import type { UserId, UserRepository, TelegramConnectionRepository, TelegramLinkingTokenRepository } from '@careeros/career';
import type { Logger, MetricsCollector } from '@careeros/providers';
import type { LinkingCommandHandler, LinkingCommandInput, LinkingCommandResult } from '@careeros/telegram';
import { generateLinkingCode, hashLinkingCode } from './telegram-linking-code.js';

/** 5 minutes, per ADR-016. */
const DEFAULT_CODE_TTL_MS = 5 * 60 * 1000;

export interface GenerateLinkingCodeResult {
  readonly code: string;
  readonly expiresAt: Date;
}

export interface LinkTelegramAccountParams {
  readonly code: string;
  readonly telegramChatId: string;
  readonly telegramUsername?: string;
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

export class InvalidLinkingCodeError extends Error {
  constructor() {
    super('Linking code is invalid or has already been used');
    this.name = 'InvalidLinkingCodeError';
  }
}

export class ExpiredLinkingCodeError extends Error {
  constructor() {
    super('Linking code has expired');
    this.name = 'ExpiredLinkingCodeError';
  }
}

export class TelegramAccountAlreadyLinkedError extends Error {
  constructor() {
    super('This Telegram account is already linked to a different CareerOS user');
    this.name = 'TelegramAccountAlreadyLinkedError';
  }
}

/**
 * Owns the whole Telegram account-linking lifecycle (ADR-016): issuing
 * one-time codes from the dashboard and verifying them against the bot's
 * /start or /link payload. The bot layer (@careeros/telegram) never makes a
 * linking decision itself — it only calls handleLinkCommand.
 */
export class TelegramLinkingService implements LinkingCommandHandler {
  constructor(
    private readonly userRepository: Pick<UserRepository, 'exists'>,
    private readonly connectionRepository: TelegramConnectionRepository,
    private readonly tokenRepository: TelegramLinkingTokenRepository,
    private readonly metrics: MetricsCollector,
    private readonly logger: Logger,
    private readonly codeTtlMs: number = DEFAULT_CODE_TTL_MS
  ) {}

  async generateLinkingCode(userId: string): Promise<GenerateLinkingCodeResult> {
    const id = createUserId(userId);
    if (!(await this.userRepository.exists(id))) {
      throw new UserNotFoundError(userId);
    }

    const code = generateLinkingCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.codeTtlMs);

    const token = TelegramLinkingToken.create({
      id: createTelegramLinkingTokenId(randomUUID()),
      userId: id,
      tokenHash: hashLinkingCode(code),
      expiresAt,
      createdAt: now,
    });
    await this.tokenRepository.save(token);

    this.metrics.incrementCounter('careeros.telegram.linking_code_generated');
    this.logger.info('Telegram linking code generated', { userId });

    return { code, expiresAt };
  }

  async linkAccount(params: LinkTelegramAccountParams): Promise<TelegramConnection> {
    const token = await this.tokenRepository.findByTokenHash(hashLinkingCode(params.code));

    if (!token || token.isUsed()) {
      this.metrics.incrementCounter('careeros.telegram.linking_invalid_code');
      throw new InvalidLinkingCodeError();
    }
    if (token.isExpired()) {
      this.metrics.incrementCounter('careeros.telegram.linking_expired_code');
      throw new ExpiredLinkingCodeError();
    }

    const existingForChat = await this.connectionRepository.findByTelegramChatId(params.telegramChatId);
    if (existingForChat && existingForChat.isActive && existingForChat.userId !== token.userId) {
      this.metrics.incrementCounter('careeros.telegram.linking_duplicate_account');
      throw new TelegramAccountAlreadyLinkedError();
    }

    // Mark the token used before persisting the connection so a crash between the two
    // steps fails closed (an unusable token) rather than open (a token usable twice).
    token.markUsed();
    await this.tokenRepository.save(token);

    const connection = await this.upsertConnection(token.userId, params);
    await this.connectionRepository.save(connection);

    this.metrics.incrementCounter('careeros.telegram.linking_success');
    this.logger.info('Telegram account linked', { userId: token.userId, telegramChatId: params.telegramChatId });

    return connection;
  }

  async handleLinkCommand(input: LinkingCommandInput): Promise<LinkingCommandResult> {
    try {
      await this.linkAccount(input);
      return {
        success: true,
        message: 'Your CareerOS account is linked! You will now receive your morning digest here.',
      };
    } catch (error) {
      if (error instanceof InvalidLinkingCodeError) {
        return { success: false, message: 'That code is invalid or already used. Generate a new one from your CareerOS dashboard.' };
      }
      if (error instanceof ExpiredLinkingCodeError) {
        return { success: false, message: 'That code has expired. Generate a new one from your CareerOS dashboard.' };
      }
      if (error instanceof TelegramAccountAlreadyLinkedError) {
        return { success: false, message: 'This Telegram account is already linked to a different CareerOS user.' };
      }
      throw error;
    }
  }

  private async upsertConnection(userId: UserId, params: LinkTelegramAccountParams): Promise<TelegramConnection> {
    const existingForUser = await this.connectionRepository.findByUserId(userId);
    if (existingForUser) {
      existingForUser.reverify(params.telegramChatId, params.telegramUsername);
      return existingForUser;
    }

    return TelegramConnection.create({
      id: createTelegramConnectionId(randomUUID()),
      userId,
      telegramChatId: params.telegramChatId,
      telegramUsername: params.telegramUsername,
    });
  }
}

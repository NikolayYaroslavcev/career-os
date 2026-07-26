import type { TelegramLinkingTokenId } from '../base/identifier.js';
import type { TelegramLinkingToken } from '../entities/telegram-linking-token.js';

export interface TelegramLinkingTokenRepository {
  findById(id: TelegramLinkingTokenId): Promise<TelegramLinkingToken | null>;
  /** Lookup by the hash of the plaintext code the user redeemed via Telegram. */
  findByTokenHash(tokenHash: string): Promise<TelegramLinkingToken | null>;
  save(token: TelegramLinkingToken): Promise<void>;
}

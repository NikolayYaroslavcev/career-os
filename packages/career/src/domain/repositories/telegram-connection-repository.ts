import type { TelegramConnectionId, UserId } from '../base/identifier.js';
import type { TelegramConnection } from '../entities/telegram-connection.js';

export interface TelegramConnectionRepository {
  findById(id: TelegramConnectionId): Promise<TelegramConnection | null>;
  findByUserId(userId: UserId): Promise<TelegramConnection | null>;
  /** Used to enforce that one Telegram chat cannot be linked to more than one CareerOS user. */
  findByTelegramChatId(telegramChatId: string): Promise<TelegramConnection | null>;
  save(connection: TelegramConnection): Promise<void>;
  delete(id: TelegramConnectionId): Promise<void>;
}

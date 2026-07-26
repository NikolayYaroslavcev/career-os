import { TelegramConnection as TelegramConnectionEntity } from '@careeros/career';
import { createTelegramConnectionId, createUserId } from '@careeros/career';
import type { TelegramConnectionStatus } from '@careeros/career';

interface PrismaTelegramConnection {
  id: string;
  userId: string;
  telegramChatId: string;
  telegramUsername: string | null;
  status: 'ACTIVE' | 'REVOKED';
  verifiedAt: Date;
  createdAt: Date;
}

export class TelegramConnectionMapper {
  static toDomain(record: PrismaTelegramConnection): TelegramConnectionEntity {
    return TelegramConnectionEntity.reconstitute(createTelegramConnectionId(record.id), {
      userId: createUserId(record.userId),
      telegramChatId: record.telegramChatId,
      telegramUsername: record.telegramUsername ?? undefined,
      status: record.status as TelegramConnectionStatus,
      verifiedAt: record.verifiedAt,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(connection: TelegramConnectionEntity): PrismaTelegramConnection {
    return {
      id: connection.id,
      userId: connection.userId,
      telegramChatId: connection.telegramChatId,
      telegramUsername: connection.telegramUsername ?? null,
      status: connection.status,
      verifiedAt: connection.verifiedAt,
      createdAt: connection.createdAt,
    };
  }
}

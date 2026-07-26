import { TelegramLinkingToken as TelegramLinkingTokenEntity } from '@careeros/career';
import { createTelegramLinkingTokenId, createUserId } from '@careeros/career';

interface PrismaTelegramLinkingToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export class TelegramLinkingTokenMapper {
  static toDomain(record: PrismaTelegramLinkingToken): TelegramLinkingTokenEntity {
    return TelegramLinkingTokenEntity.reconstitute(createTelegramLinkingTokenId(record.id), {
      userId: createUserId(record.userId),
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt ?? undefined,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(token: TelegramLinkingTokenEntity): PrismaTelegramLinkingToken {
    return {
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      usedAt: token.usedAt ?? null,
      createdAt: token.createdAt,
    };
  }
}

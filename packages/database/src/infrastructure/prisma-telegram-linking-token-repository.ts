import type { TelegramLinkingTokenRepository, TelegramLinkingToken, TelegramLinkingTokenId } from '@careeros/career';
import { prisma } from '../client.js';
import { TelegramLinkingTokenMapper } from '../mappers/telegram-linking-token-mapper.js';

export class PrismaTelegramLinkingTokenRepository implements TelegramLinkingTokenRepository {
  async findById(id: TelegramLinkingTokenId): Promise<TelegramLinkingToken | null> {
    const record = await prisma.telegramLinkingToken.findUnique({ where: { id } });
    return record ? TelegramLinkingTokenMapper.toDomain(record) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<TelegramLinkingToken | null> {
    const record = await prisma.telegramLinkingToken.findUnique({ where: { tokenHash } });
    return record ? TelegramLinkingTokenMapper.toDomain(record) : null;
  }

  async save(token: TelegramLinkingToken): Promise<void> {
    const data = TelegramLinkingTokenMapper.toPersistence(token);

    await prisma.telegramLinkingToken.upsert({
      where: { id: token.id },
      create: data,
      update: data,
    });
  }
}

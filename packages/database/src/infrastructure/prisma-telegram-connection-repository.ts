import type { TelegramConnectionRepository, TelegramConnection, TelegramConnectionId, UserId } from '@careeros/career';
import { prisma } from '../client.js';
import { TelegramConnectionMapper } from '../mappers/telegram-connection-mapper.js';

export class PrismaTelegramConnectionRepository implements TelegramConnectionRepository {
  async findById(id: TelegramConnectionId): Promise<TelegramConnection | null> {
    const record = await prisma.telegramConnection.findUnique({ where: { id } });
    return record ? TelegramConnectionMapper.toDomain(record) : null;
  }

  async findByUserId(userId: UserId): Promise<TelegramConnection | null> {
    const record = await prisma.telegramConnection.findUnique({ where: { userId } });
    return record ? TelegramConnectionMapper.toDomain(record) : null;
  }

  async findByTelegramChatId(telegramChatId: string): Promise<TelegramConnection | null> {
    const record = await prisma.telegramConnection.findUnique({ where: { telegramChatId } });
    return record ? TelegramConnectionMapper.toDomain(record) : null;
  }

  async save(connection: TelegramConnection): Promise<void> {
    const data = TelegramConnectionMapper.toPersistence(connection);

    await prisma.telegramConnection.upsert({
      where: { id: connection.id },
      create: data,
      update: data,
    });
  }

  async delete(id: TelegramConnectionId): Promise<void> {
    await prisma.telegramConnection.delete({ where: { id } });
  }
}

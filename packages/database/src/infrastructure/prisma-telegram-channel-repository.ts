import { prisma } from '../client.js';

export interface TelegramChannelData {
  id: string;
  username: string;
  enabled: boolean;
  category: string | null;
  description: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTelegramChannelInput {
  username: string;
  enabled?: boolean;
  category?: string;
  description?: string;
}

export interface UpdateTelegramChannelInput {
  enabled?: boolean;
  category?: string;
  description?: string;
  lastSyncAt?: Date;
}

export class PrismaTelegramChannelRepository {
  async create(input: CreateTelegramChannelInput): Promise<TelegramChannelData> {
    return prisma.telegramChannel.create({
      data: {
        username: input.username.toLowerCase().replace(/^@/, ''),
        enabled: input.enabled ?? true,
        category: input.category ?? null,
        description: input.description ?? null,
      },
    });
  }

  async findById(id: string): Promise<TelegramChannelData | null> {
    return prisma.telegramChannel.findUnique({ where: { id } });
  }

  async findByUsername(username: string): Promise<TelegramChannelData | null> {
    return prisma.telegramChannel.findUnique({
      where: { username: username.toLowerCase().replace(/^@/, '') },
    });
  }

  async findAll(): Promise<TelegramChannelData[]> {
    return prisma.telegramChannel.findMany({ orderBy: { username: 'asc' } });
  }

  async findEnabled(): Promise<TelegramChannelData[]> {
    return prisma.telegramChannel.findMany({
      where: { enabled: true },
      orderBy: { username: 'asc' },
    });
  }

  async findEnabledUsernames(): Promise<string[]> {
    const channels = await prisma.telegramChannel.findMany({
      where: { enabled: true },
      select: { username: true },
      orderBy: { username: 'asc' },
    });
    return channels.map((c) => c.username);
  }

  async update(id: string, input: UpdateTelegramChannelInput): Promise<TelegramChannelData | null> {
    const existing = await prisma.telegramChannel.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.telegramChannel.update({
      where: { id },
      data: {
        enabled: input.enabled,
        category: input.category,
        description: input.description,
        lastSyncAt: input.lastSyncAt,
      },
    });
  }

  async updateByUsername(username: string, input: UpdateTelegramChannelInput): Promise<TelegramChannelData | null> {
    const existing = await prisma.telegramChannel.findUnique({
      where: { username: username.toLowerCase().replace(/^@/, '') },
    });
    if (!existing) return null;

    return prisma.telegramChannel.update({
      where: { username: username.toLowerCase().replace(/^@/, '') },
      data: {
        enabled: input.enabled,
        category: input.category,
        description: input.description,
        lastSyncAt: input.lastSyncAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.telegramChannel.delete({ where: { id } });
  }

  async deleteByUsername(username: string): Promise<void> {
    await prisma.telegramChannel.deleteMany({
      where: { username: username.toLowerCase().replace(/^@/, '') },
    });
  }

  async count(): Promise<number> {
    return prisma.telegramChannel.count();
  }

  async countEnabled(): Promise<number> {
    return prisma.telegramChannel.count({ where: { enabled: true } });
  }

  /**
   * Seed channels from ENV TELEGRAM_CHANNELS for migration compatibility.
   * Only inserts channels that don't already exist in the database.
   */
  async seedFromEnv(envChannels: string): Promise<TelegramChannelData[]> {
    const channels = envChannels
      .split(',')
      .map((c) => c.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, ''))
      .filter(Boolean);

    const created: TelegramChannelData[] = [];

    for (const username of channels) {
      const existing = await prisma.telegramChannel.findUnique({
        where: { username: username.toLowerCase() },
      });
      if (!existing) {
        const record = await prisma.telegramChannel.create({
          data: { username: username.toLowerCase(), enabled: true },
        });
        created.push(record);
      }
    }

    return created;
  }
}

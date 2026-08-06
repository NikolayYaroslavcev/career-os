import { validateTelegramChannelUsername } from '@careeros/shared';
import { prisma } from '../client.js';
import type { TelegramChannelStatsData } from './prisma-telegram-channel-stats-repository.js';

export type TelegramChannelTransport = 'HTML_PREVIEW' | 'BOT_API' | 'MTPROTO' | 'EXPORT';

export interface TelegramChannelData {
  id: string;
  username: string;
  name: string | null;
  transport: TelegramChannelTransport;
  chatId: string | null;
  language: string | null;
  country: string | null;
  enabled: boolean;
  category: string | null;
  description: string | null;
  ownerWorkspaceId: string | null;
  defaultPriority: number;
  defaultSyncIntervalMs: number;
  defaultAiExtractionOn: boolean;
  defaultMinConfidence: number;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Only populated by findAll()/findEnabled() (which `include` the relation) — absent elsewhere. */
  stats?: TelegramChannelStatsData | null;
}

export interface CreateTelegramChannelInput {
  username: string;
  name?: string;
  transport?: TelegramChannelTransport;
  chatId?: string;
  language?: string;
  country?: string;
  enabled?: boolean;
  category?: string;
  description?: string;
  ownerWorkspaceId?: string;
  defaultPriority?: number;
  defaultSyncIntervalMs?: number;
  defaultAiExtractionOn?: boolean;
  defaultMinConfidence?: number;
}

export interface UpdateTelegramChannelInput {
  name?: string;
  transport?: TelegramChannelTransport;
  chatId?: string;
  language?: string;
  country?: string;
  enabled?: boolean;
  category?: string;
  description?: string;
  ownerWorkspaceId?: string;
  defaultPriority?: number;
  defaultSyncIntervalMs?: number;
  defaultAiExtractionOn?: boolean;
  defaultMinConfidence?: number;
  lastSyncAt?: Date;
}

function normalizeUsername(username: string): string {
  return username.toLowerCase().replace(/^@/, '');
}

export class PrismaTelegramChannelRepository {
  async create(input: CreateTelegramChannelInput): Promise<TelegramChannelData> {
    const username = normalizeUsername(input.username);
    validateTelegramChannelUsername(username);

    return prisma.telegramChannel.create({
      data: {
        username,
        name: input.name ?? null,
        transport: input.transport ?? 'HTML_PREVIEW',
        chatId: input.chatId ?? null,
        language: input.language ?? null,
        country: input.country ?? null,
        enabled: input.enabled ?? true,
        category: input.category ?? null,
        description: input.description ?? null,
        ownerWorkspaceId: input.ownerWorkspaceId ?? null,
        defaultPriority: input.defaultPriority ?? 0,
        defaultSyncIntervalMs: input.defaultSyncIntervalMs ?? 900000,
        defaultAiExtractionOn: input.defaultAiExtractionOn ?? true,
        defaultMinConfidence: input.defaultMinConfidence ?? 50,
      },
    });
  }

  async findById(id: string): Promise<TelegramChannelData | null> {
    return prisma.telegramChannel.findUnique({ where: { id } });
  }

  async findByUsername(username: string): Promise<TelegramChannelData | null> {
    return prisma.telegramChannel.findUnique({
      where: { username: normalizeUsername(username) },
    });
  }

  async findAll(): Promise<TelegramChannelData[]> {
    return prisma.telegramChannel.findMany({ orderBy: { username: 'asc' }, include: { stats: true } });
  }

  async findEnabled(): Promise<TelegramChannelData[]> {
    return prisma.telegramChannel.findMany({
      where: { enabled: true },
      orderBy: { username: 'asc' },
      include: { stats: true },
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
        name: input.name,
        transport: input.transport,
        chatId: input.chatId,
        language: input.language,
        country: input.country,
        enabled: input.enabled,
        category: input.category,
        description: input.description,
        ownerWorkspaceId: input.ownerWorkspaceId,
        defaultPriority: input.defaultPriority,
        defaultSyncIntervalMs: input.defaultSyncIntervalMs,
        defaultAiExtractionOn: input.defaultAiExtractionOn,
        defaultMinConfidence: input.defaultMinConfidence,
        lastSyncAt: input.lastSyncAt,
      },
    });
  }

  async updateByUsername(username: string, input: UpdateTelegramChannelInput): Promise<TelegramChannelData | null> {
    const normalized = normalizeUsername(username);
    const existing = await prisma.telegramChannel.findUnique({ where: { username: normalized } });
    if (!existing) return null;

    return prisma.telegramChannel.update({
      where: { username: normalized },
      data: {
        name: input.name,
        transport: input.transport,
        chatId: input.chatId,
        language: input.language,
        country: input.country,
        enabled: input.enabled,
        category: input.category,
        description: input.description,
        ownerWorkspaceId: input.ownerWorkspaceId,
        defaultPriority: input.defaultPriority,
        defaultSyncIntervalMs: input.defaultSyncIntervalMs,
        defaultAiExtractionOn: input.defaultAiExtractionOn,
        defaultMinConfidence: input.defaultMinConfidence,
        lastSyncAt: input.lastSyncAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.telegramChannel.delete({ where: { id } });
  }

  async deleteByUsername(username: string): Promise<void> {
    await prisma.telegramChannel.deleteMany({
      where: { username: normalizeUsername(username) },
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
   * Only inserts channels that don't already exist in the database — safe to
   * call on every backend boot (see apps/backend/src/container.ts), which is
   * what makes the DB become the source of truth without a manual script.
   * A malformed entry (bad username) is skipped with a warning rather than
   * aborting the whole seed run — one bad entry in TELEGRAM_CHANNELS must not
   * block every other channel from being bootstrapped.
   */
  async seedFromEnv(envChannels: string): Promise<TelegramChannelData[]> {
    const channels = envChannels
      .split(',')
      .map((c) => c.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, ''))
      .filter(Boolean);

    const created: TelegramChannelData[] = [];

    for (const rawUsername of channels) {
      const username = normalizeUsername(rawUsername);
      try {
        validateTelegramChannelUsername(username);
      } catch {
        continue;
      }

      const existing = await prisma.telegramChannel.findUnique({ where: { username } });
      if (!existing) {
        const record = await prisma.telegramChannel.create({
          data: { username, enabled: true },
        });
        created.push(record);
      }
    }

    return created;
  }
}

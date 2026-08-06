import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaTelegramChannelRepository } = await import('../prisma-telegram-channel-repository.js');
const { InvalidTelegramChannelUsernameError } = await import('@careeros/shared');

function fakeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ch-1',
    username: 'remoteit',
    name: null,
    transport: 'HTML_PREVIEW',
    chatId: null,
    language: null,
    country: null,
    enabled: true,
    category: null,
    description: null,
    ownerWorkspaceId: null,
    defaultPriority: 0,
    defaultSyncIntervalMs: 900000,
    defaultAiExtractionOn: true,
    defaultMinConfidence: 50,
    lastSyncAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('PrismaTelegramChannelRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaTelegramChannelRepository>;

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaTelegramChannelRepository();
  });

  describe('create', () => {
    it('normalizes username (lowercase, strips leading @) before writing', async () => {
      (prisma.telegramChannel.create as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRow());

      await repository.create({ username: '@RemoteIT' });

      expect(prisma.telegramChannel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ username: 'remoteit' }),
      });
    });

    it('rejects a malformed username without calling prisma at all', async () => {
      await expect(repository.create({ username: '@' })).rejects.toThrow(InvalidTelegramChannelUsernameError);
      expect(prisma.telegramChannel.create).not.toHaveBeenCalled();
    });

    it('rejects a username that is too short', async () => {
      await expect(repository.create({ username: 'abcd' })).rejects.toThrow(InvalidTelegramChannelUsernameError);
    });

    it('defaults transport/priority/sync-interval/ai-extraction/min-confidence when omitted', async () => {
      (prisma.telegramChannel.create as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRow());

      await repository.create({ username: 'remoteit' });

      expect(prisma.telegramChannel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transport: 'HTML_PREVIEW',
          defaultPriority: 0,
          defaultSyncIntervalMs: 900000,
          defaultAiExtractionOn: true,
          defaultMinConfidence: 50,
        }),
      });
    });

    it('passes through the richer optional fields when provided', async () => {
      (prisma.telegramChannel.create as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRow({ language: 'ru', country: 'RU' }));

      await repository.create({ username: 'remoteit', language: 'ru', country: 'RU', category: 'devops' });

      expect(prisma.telegramChannel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ language: 'ru', country: 'RU', category: 'devops' }),
      });
    });
  });

  describe('findByUsername / updateByUsername / deleteByUsername', () => {
    it('normalizes username on lookup', async () => {
      (prisma.telegramChannel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRow());
      await repository.findByUsername('@RemoteIT');
      expect(prisma.telegramChannel.findUnique).toHaveBeenCalledWith({ where: { username: 'remoteit' } });
    });

    it('returns null from updateByUsername when the channel does not exist', async () => {
      (prisma.telegramChannel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const result = await repository.updateByUsername('missing', { enabled: false });
      expect(result).toBeNull();
      expect(prisma.telegramChannel.update).not.toHaveBeenCalled();
    });
  });

  describe('seedFromEnv', () => {
    it('only inserts channels that do not already exist', async () => {
      (prisma.telegramChannel.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(fakeRow({ username: 'remoteit' })) // already exists
        .mockResolvedValueOnce(null); // new
      (prisma.telegramChannel.create as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRow({ username: 'geekjobs' }));

      const created = await repository.seedFromEnv('remoteit, geekjobs');

      expect(created).toHaveLength(1);
      expect(created[0]?.username).toBe('geekjobs');
      expect(prisma.telegramChannel.create).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — seeding the same list twice creates nothing the second time', async () => {
      (prisma.telegramChannel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      (prisma.telegramChannel.create as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRow());
      const first = await repository.seedFromEnv('remoteit');
      expect(first).toHaveLength(1);

      (prisma.telegramChannel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeRow());
      const second = await repository.seedFromEnv('remoteit');
      expect(second).toHaveLength(0);
      expect(prisma.telegramChannel.create).toHaveBeenCalledTimes(1);
    });

    it('skips a malformed entry without aborting the rest of the seed run', async () => {
      (prisma.telegramChannel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      (prisma.telegramChannel.create as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRow({ username: 'geekjobs' }));

      const created = await repository.seedFromEnv('@, geekjobs');

      expect(created).toHaveLength(1);
      expect(created[0]?.username).toBe('geekjobs');
      expect(prisma.telegramChannel.create).toHaveBeenCalledTimes(1);
    });

    it('strips @ and t.me/ prefixes before checking existence', async () => {
      (prisma.telegramChannel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      (prisma.telegramChannel.create as ReturnType<typeof vi.fn>).mockResolvedValue(fakeRow());

      await repository.seedFromEnv('https://t.me/remoteit');

      expect(prisma.telegramChannel.findUnique).toHaveBeenCalledWith({ where: { username: 'remoteit' } });
    });
  });
});

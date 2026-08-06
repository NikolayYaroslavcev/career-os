import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderManagementService } from '../provider-management-service.js';
import type { ProviderRegistry, Logger } from '@careeros/providers';
import type { SyncSchedulerService } from '../sync-scheduler-service.js';

function createMockProviderConfigRepo(): {
  upsert: ReturnType<typeof vi.fn>;
  findByProviderId: ReturnType<typeof vi.fn>;
  findAll: ReturnType<typeof vi.fn>;
  findEnabled: ReturnType<typeof vi.fn>;
  findSyncEnabled: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  isProviderEnabled: ReturnType<typeof vi.fn>;
  isProviderSyncEnabled: ReturnType<typeof vi.fn>;
} {
  return {
    upsert: vi.fn().mockImplementation((input) => Promise.resolve({
      id: 'mock-id',
      providerId: input.providerId,
      enabled: input.enabled ?? true,
      syncEnabled: input.syncEnabled ?? true,
      status: input.status ?? 'READY',
      settings: input.settings ?? null,
      qualityScore: input.qualityScore ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findByProviderId: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    findEnabled: vi.fn().mockResolvedValue([]),
    findSyncEnabled: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockImplementation((providerId, input) => Promise.resolve({
      id: 'mock-id',
      providerId,
      enabled: input.enabled ?? true,
      syncEnabled: input.syncEnabled ?? true,
      status: input.status ?? 'READY',
      settings: input.settings ?? null,
      qualityScore: input.qualityScore ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    delete: vi.fn(),
    isProviderEnabled: vi.fn().mockResolvedValue(true),
    isProviderSyncEnabled: vi.fn().mockResolvedValue(true),
  };
}

function createMockTelegramChannelRepo(): {
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByUsername: ReturnType<typeof vi.fn>;
  findAll: ReturnType<typeof vi.fn>;
  findEnabled: ReturnType<typeof vi.fn>;
  findEnabledUsernames: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateByUsername: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteByUsername: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  countEnabled: ReturnType<typeof vi.fn>;
  seedFromEnv: ReturnType<typeof vi.fn>;
} {
  const channels: Array<{ id: string; username: string; enabled: boolean; category: string | null; description: string | null; lastSyncAt: Date | null; createdAt: Date; updatedAt: Date }> = [];

  return {
    create: vi.fn().mockImplementation((input) => {
      const channel = {
        id: `ch-${channels.length + 1}`,
        username: input.username.toLowerCase(),
        enabled: input.enabled ?? true,
        category: input.category ?? null,
        description: input.description ?? null,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      channels.push(channel);
      return Promise.resolve(channel);
    }),
    findById: vi.fn().mockResolvedValue(null),
    findByUsername: vi.fn().mockImplementation((username) => {
      return Promise.resolve(channels.find((c) => c.username === username.toLowerCase()) ?? null);
    }),
    findAll: vi.fn().mockImplementation(() => Promise.resolve(channels)),
    findEnabled: vi.fn().mockImplementation(() => Promise.resolve(channels.filter((c) => c.enabled))),
    findEnabledUsernames: vi.fn().mockImplementation(() => Promise.resolve(channels.filter((c) => c.enabled).map((c) => c.username))),
    update: vi.fn().mockImplementation((id, input) => {
      const ch = channels.find((c) => c.id === id);
      if (!ch) return Promise.resolve(null);
      if (input.enabled !== undefined) ch.enabled = input.enabled;
      if (input.category !== undefined) ch.category = input.category;
      if (input.description !== undefined) ch.description = input.description;
      return Promise.resolve(ch);
    }),
    updateByUsername: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockImplementation((id) => {
      const idx = channels.findIndex((c) => c.id === id);
      if (idx !== -1) channels.splice(idx, 1);
      return Promise.resolve();
    }),
    deleteByUsername: vi.fn(),
    count: vi.fn().mockImplementation(() => Promise.resolve(channels.length)),
    countEnabled: vi.fn().mockImplementation(() => Promise.resolve(channels.filter((c) => c.enabled).length)),
    seedFromEnv: vi.fn().mockImplementation((envChannels: string) => {
      const chs = envChannels.split(',').map((c) => c.trim()).filter(Boolean);
      const created: Array<{ id: string; username: string; enabled: boolean }> = [];
      for (const username of chs) {
        if (!channels.find((c) => c.username === username.toLowerCase())) {
          const ch = { id: `ch-${channels.length + 1}`, username: username.toLowerCase(), enabled: true, category: null, description: null, lastSyncAt: null, createdAt: new Date(), updatedAt: new Date() };
          channels.push(ch);
          created.push(ch);
        }
      }
      return Promise.resolve(created);
    }),
  };
}

function createMockRegistry(): ProviderRegistry {
  return {
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn(),
  } as unknown as ProviderRegistry;
}

function createMockSyncScheduler(): SyncSchedulerService {
  return {
    stopProvider: vi.fn(),
    startProvider: vi.fn(),
  } as unknown as SyncSchedulerService;
}

function createMockLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

describe('ProviderManagementService - Telegram Channels', () => {
  let service: ProviderManagementService;
  let telegramRepo: ReturnType<typeof createMockTelegramChannelRepo>;

  beforeEach(() => {
    telegramRepo = createMockTelegramChannelRepo();
    service = new ProviderManagementService(
      createMockProviderConfigRepo(),
      telegramRepo,
      createMockRegistry(),
      createMockSyncScheduler(),
      createMockLogger(),
    );
  });

  it('should add a Telegram channel', async () => {
    const channel = await service.addTelegramChannel({
      username: 'remoteit',
      enabled: true,
      category: 'Backend',
    });

    expect(channel.username).toBe('remoteit');
    expect(channel.enabled).toBe(true);
    expect(channel.category).toBe('Backend');
    expect(telegramRepo.create).toHaveBeenCalled();
  });

  it('should not add duplicate channel', async () => {
    await service.addTelegramChannel({ username: 'remoteit' });

    await expect(
      service.addTelegramChannel({ username: 'remoteit' })
    ).rejects.toThrow('already exists');
  });

  it('should toggle channel enabled/disabled', async () => {
    const channel = await service.addTelegramChannel({ username: 'geekjobs' });
    const updated = await service.toggleTelegramChannel(channel.id, false);

    expect(updated.enabled).toBe(false);
  });

  it('should delete channel', async () => {
    const channel = await service.addTelegramChannel({ username: 'test_channel' });
    await service.removeTelegramChannel(channel.id);

    expect(telegramRepo.delete).toHaveBeenCalledWith(channel.id);
  });

  it('should list all channels', async () => {
    await service.addTelegramChannel({ username: 'channel1' });
    await service.addTelegramChannel({ username: 'channel2' });

    const channels = await service.getAllTelegramChannels();
    expect(channels.length).toBe(2);
  });

  it('should return enabled channel usernames', async () => {
    await service.addTelegramChannel({ username: 'enabled_channel', enabled: true });
    const ch = await service.addTelegramChannel({ username: 'disabled_channel', enabled: false });
    await service.toggleTelegramChannel(ch.id, false);

    const usernames = await service.getEnabledTelegramUsernames();
    expect(usernames).toContain('enabled_channel');
    expect(usernames).not.toContain('disabled_channel');
  });

  it('should get channels for fetcher with DB priority', async () => {
    await service.addTelegramChannel({ username: 'db_channel' });

    const channels = await service.getTelegramChannelsForFetcher('env_channel1,env_channel2');
    expect(channels).toContain('db_channel');
    expect(channels).not.toContain('env_channel1');
  });

  it('should fall back to ENV when no DB channels', async () => {
    const channels = await service.getTelegramChannelsForFetcher('env_channel1,env_channel2');
    expect(channels).toContain('env_channel1');
    expect(channels).toContain('env_channel2');
  });

  it('should seed channels from ENV', async () => {
    const created = await service.seedTelegramChannelsFromEnv('channel_a,channel_b,channel_c');
    expect(created.length).toBe(3);
  });

  it('should not re-seed existing channels', async () => {
    await service.addTelegramChannel({ username: 'existing' });
    const created = await service.seedTelegramChannelsFromEnv('existing, new_channel');
    expect(created.length).toBe(1);
    expect(created[0]?.username).toBe('new_channel');
  });
});

describe('ProviderManagementService - Provider Enable/Disable', () => {
  let service: ProviderManagementService;
  let configRepo: ReturnType<typeof createMockProviderConfigRepo>;
  let syncScheduler: ReturnType<typeof createMockSyncScheduler>;

  beforeEach(() => {
    configRepo = createMockProviderConfigRepo();
    syncScheduler = createMockSyncScheduler();
    service = new ProviderManagementService(
      configRepo,
      createMockTelegramChannelRepo(),
      createMockRegistry(),
      syncScheduler,
      createMockLogger(),
    );
  });

  it('should toggle provider enabled/disabled', async () => {
    const config = await service.updateProvider('linkedin', { enabled: false });

    expect(config.enabled).toBe(false);
    expect(syncScheduler.stopProvider).toHaveBeenCalledWith('linkedin');
  });

  it('should enable provider and start sync', async () => {
    const config = await service.updateProvider('linkedin', { enabled: true });

    expect(config.enabled).toBe(true);
    expect(syncScheduler.startProvider).toHaveBeenCalled();
  });

  it('should check if provider is enabled', async () => {
    const enabled = await service.isProviderEnabled('hh');
    expect(enabled).toBe(true);
  });

  it('should list all providers', async () => {
    const providers = await service.getAllProviders('workspace-1');
    expect(Array.isArray(providers)).toBe(true);
  });
});

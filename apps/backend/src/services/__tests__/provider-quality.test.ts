import { describe, it, expect, vi } from 'vitest';
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
    update: vi.fn(),
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
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByUsername: vi.fn(),
    findAll: vi.fn().mockResolvedValue([]),
    findEnabled: vi.fn().mockResolvedValue([]),
    findEnabledUsernames: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    updateByUsername: vi.fn(),
    delete: vi.fn(),
    deleteByUsername: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    countEnabled: vi.fn().mockResolvedValue(0),
    seedFromEnv: vi.fn().mockResolvedValue([]),
  };
}

function createMockQualityDataRepo(sources: Array<{ sourceUrl: string | null; salaryMin: number | null; salaryMax: number | null; location: string | null }> = [], companyCount = 0): {
  findSourcesWithVacancies: ReturnType<typeof vi.fn>;
  countDistinctCompaniesByProvider: ReturnType<typeof vi.fn>;
} {
  return {
    findSourcesWithVacancies: vi.fn().mockResolvedValue(sources),
    countDistinctCompaniesByProvider: vi.fn().mockResolvedValue(companyCount),
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

describe('ProviderManagementService - Quality Score', () => {
  it('should return default quality metrics when no data exists', async () => {
    const service = new ProviderManagementService(
      createMockProviderConfigRepo(),
      createMockTelegramChannelRepo(),
      createMockRegistry(),
      createMockSyncScheduler(),
      createMockLogger(),
      createMockQualityDataRepo(),
    );

    const quality = await service.calculateProviderQuality('nonexistent_provider_xyz');

    expect(quality.providerId).toBe('nonexistent_provider_xyz');
    expect(typeof quality.qualityScore).toBe('number');
    expect(quality.qualityScore).toBeGreaterThanOrEqual(0);
    expect(quality.qualityScore).toBeLessThanOrEqual(100);
    expect(quality.totalVacancies).toBe(0);
  });

  it('should calculate quality metrics from vacancy data', async () => {
    const configRepo = createMockProviderConfigRepo();
    const sources = [
      { sourceUrl: 'https://example.com/1', salaryMin: 100, salaryMax: 200, location: 'Moscow' },
      { sourceUrl: 'https://example.com/2', salaryMin: null, salaryMax: null, location: null },
      { sourceUrl: null, salaryMin: 150, salaryMax: 250, location: 'SPb' },
    ];
    const qualityRepo = createMockQualityDataRepo(sources, 2);

    const service = new ProviderManagementService(
      configRepo,
      createMockTelegramChannelRepo(),
      createMockRegistry(),
      createMockSyncScheduler(),
      createMockLogger(),
      qualityRepo,
    );

    const quality = await service.calculateProviderQuality('telegram');

    expect(quality).toBeDefined();
    expect(typeof quality.qualityScore).toBe('number');
    expect(quality.qualityScore).toBeGreaterThanOrEqual(0);
    expect(quality.qualityScore).toBeLessThanOrEqual(100);
    expect(quality.totalVacancies).toBe(3);
    expect(quality.missingSalary).toBe(1);
    expect(quality.missingLocation).toBe(1);
    expect(quality.invalidUrls).toBe(1);
    expect(quality.missingCompany).toBe(1);
  });

  it('should return base metrics when no qualityDataRepo provided', async () => {
    const service = new ProviderManagementService(
      createMockProviderConfigRepo(),
      createMockTelegramChannelRepo(),
      createMockRegistry(),
      createMockSyncScheduler(),
      createMockLogger(),
    );

    const quality = await service.calculateProviderQuality('telegram');

    expect(quality.totalVacancies).toBe(0);
    expect(quality.qualityScore).toBe(50);
  });

  it('should list all provider qualities', async () => {
    const service = new ProviderManagementService(
      createMockProviderConfigRepo(),
      createMockTelegramChannelRepo(),
      createMockRegistry(),
      createMockSyncScheduler(),
      createMockLogger(),
      createMockQualityDataRepo(),
    );

    const qualities = await service.getAllProviderQualities('workspace-1');
    expect(Array.isArray(qualities)).toBe(true);
  });
});

describe('ProviderManagementService - state ownership', () => {
  it('reads health/counts from SyncSchedulerService, not from a frozen registry snapshot', async () => {
    const registry = {
      getAll: vi.fn().mockReturnValue([{ info: { id: 'hh' } }]),
      get: vi.fn(),
      getState: vi.fn(() => {
        throw new Error('ProviderRegistry.getState() must not be read as live state');
      }),
    } as unknown as ProviderRegistry;

    const syncScheduler = {
      getStatus: vi.fn((_workspaceId: string, providerId: string) =>
        providerId === 'hh'
          ? {
              providerId,
              lastSyncAt: new Date('2026-07-25T00:00:00.000Z'),
              lastSyncResult: 'success' as const,
              nextSyncAt: null,
              totalJobsSynced: 12,
              health: 'healthy' as const,
              importedCount: 15,
              failedCount: 1,
              consecutiveFailures: 0,
            }
          : undefined,
      ),
      stopProvider: vi.fn(),
      startProvider: vi.fn(),
    } as unknown as SyncSchedulerService;

    const service = new ProviderManagementService(
      createMockProviderConfigRepo(),
      createMockTelegramChannelRepo(),
      registry,
      syncScheduler,
      createMockLogger(),
    );

    const providers = await service.getAllProviders('workspace-1');
    const hh = providers.find((p) => p.providerId === 'hh');

    expect(hh?.health).toBe('healthy');
    expect(hh?.importedCount).toBe(15);
    expect(hh?.failedCount).toBe(1);
    expect(hh?.totalSynced).toBe(12);
  });

  it('falls back to unknown/zero when a registered provider has never synced', async () => {
    const registry = {
      getAll: vi.fn().mockReturnValue([{ info: { id: 'greenhouse' } }]),
      get: vi.fn(),
    } as unknown as ProviderRegistry;

    const syncScheduler = {
      getStatus: vi.fn().mockReturnValue(undefined),
      stopProvider: vi.fn(),
      startProvider: vi.fn(),
    } as unknown as SyncSchedulerService;

    const service = new ProviderManagementService(
      createMockProviderConfigRepo(),
      createMockTelegramChannelRepo(),
      registry,
      syncScheduler,
      createMockLogger(),
    );

    const provider = await service.getProvider('greenhouse', 'workspace-1');

    expect(provider?.health).toBe('unknown');
    expect(provider?.importedCount).toBe(0);
    expect(provider?.consecutiveFailures).toBe(0);
    expect(provider?.lastSync).toBeNull();
  });
});

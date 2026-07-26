import { describe, it, expect, vi } from 'vitest';
import { ProviderRegistry, ProviderNotFoundError } from '../registry/provider-registry.js';
import type { ProviderJob } from '../interfaces/provider-job.js';

const createMockProvider = (id: string): ProviderJob => ({
  info: {
    id,
    name: `Provider ${id}`,
    version: '1.0.0',
    supportedCountries: ['US'],
    supportedLanguages: ['en'],
    auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: true },
    supportsRemote: true,
    baseUrl: 'https://example.com',
  },
  capabilities: {
    search: { supported: true, maxResults: 100, supportsKeyword: true, supportsLocation: true, supportsTechnology: true },
    pagination: { strategy: 'page', maxPageSize: 100, defaultPageSize: 20 },
    sync: { incremental: true, fullSync: true, minSyncIntervalMs: 3600000 },
    filtering: { experienceLevels: [], salaryFilter: true, remoteFilter: true, technologyFilter: true, dateFilter: true },
    rateLimits: { perMinute: 60, providesHeaders: true, providesInfo: true },
    characteristics: { avgResponseTimeMs: 200, fullDescription: true, salaryData: true, companyDetails: true },
  },
  state: {
    providerId: id,
    lastSync: null,
    nextSync: null,
    health: 'unknown',
    importedCount: 0,
    failedCount: 0,
    normalizedCount: 0,
    deduplicatedCount: 0,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    avgResponseTimeMs: 0,
    totalRequests: 0,
    updatedAt: new Date(),
  },
  fetcher: {} as ProviderJob['fetcher'],
  mapper: {} as ProviderJob['mapper'],
  normalizer: {} as ProviderJob['normalizer'],
  syncStrategy: {} as ProviderJob['syncStrategy'],
  initialize: vi.fn(),
  search: vi.fn(),
  getVacancy: vi.fn(),
  sync: vi.fn(),
  healthCheck: vi.fn(),
  dispose: vi.fn(),
});

describe('ProviderRegistry', () => {
  it('should register and retrieve providers', () => {
    const registry = new ProviderRegistry();
    const provider = createMockProvider('hh');

    registry.register(provider);
    const retrieved = registry.get('hh');

    expect(retrieved).toBe(provider);
  });

  it('should throw on duplicate registration', () => {
    const registry = new ProviderRegistry();
    const provider = createMockProvider('hh');

    registry.register(provider);
    expect(() => registry.register(provider)).toThrow(ProviderNotFoundError);
  });

  it('should throw when getting non-existent provider', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.get('nonexistent')).toThrow(ProviderNotFoundError);
  });

  it('should return all registered providers', () => {
    const registry = new ProviderRegistry();
    const provider1 = createMockProvider('hh');
    const provider2 = createMockProvider('linkedin');

    registry.register(provider1);
    registry.register(provider2);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });

  it('should initialize all providers', async () => {
    const registry = new ProviderRegistry();
    const provider = createMockProvider('hh');

    registry.register(provider);
    const configs = new Map<string, Record<string, string>>();
    configs.set('hh', { apiKey: 'test' });
    await registry.initializeAll(configs);

    expect(provider.initialize).toHaveBeenCalled();
    expect(registry.isReady('hh')).toBe(true);
  });

  it('should dispose all providers', async () => {
    const registry = new ProviderRegistry();
    const provider = createMockProvider('hh');

    registry.register(provider);
    const configs = new Map<string, Record<string, string>>();
    configs.set('hh', {});
    await registry.initializeAll(configs);
    await registry.disposeAll();

    expect(provider.dispose).toHaveBeenCalled();
    expect(registry.isReady('hh')).toBe(false);
  });
});

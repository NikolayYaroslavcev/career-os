import { describe, it, expect, vi } from 'vitest';
import { ProviderHealthMonitor } from '../health/provider-health-monitor.js';
import type { ProviderJob } from '../interfaces/provider-job.js';

const createMockProvider = (healthy: boolean, latencyMs: number): ProviderJob => ({
  info: {
    id: 'test-provider',
    name: 'Test Provider',
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
    providerId: 'test-provider',
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
  healthCheck: vi.fn().mockResolvedValue({ healthy, latencyMs, message: healthy ? undefined : 'Error' }),
  dispose: vi.fn(),
});

describe('ProviderHealthMonitor', () => {
  it('should check provider health', async () => {
    const monitor = new ProviderHealthMonitor({
      checkIntervalMs: 60000,
      unhealthyThreshold: 3,
      degradedThresholdMs: 500,
      healthyThresholdMs: 200,
    });

    const provider = createMockProvider(true, 100);
    const result = await monitor.checkProvider(provider);

    expect(result.healthy).toBe(true);
    expect(result.state).toBe('healthy');
    expect(result.latencyMs).toBe(100);
  });

  it('should detect unhealthy provider', async () => {
    const monitor = new ProviderHealthMonitor({
      checkIntervalMs: 60000,
      unhealthyThreshold: 3,
      degradedThresholdMs: 500,
      healthyThresholdMs: 200,
    });

    const provider = createMockProvider(false, 100);
    const result = await monitor.checkProvider(provider);

    expect(result.healthy).toBe(false);
    expect(result.state).toBe('unhealthy');
  });

  it('should detect degraded provider', async () => {
    const monitor = new ProviderHealthMonitor({
      checkIntervalMs: 60000,
      unhealthyThreshold: 3,
      degradedThresholdMs: 500,
      healthyThresholdMs: 200,
    });

    const provider = createMockProvider(true, 1000);
    const result = await monitor.checkProvider(provider);

    expect(result.healthy).toBe(true);
    expect(result.state).toBe('degraded');
  });

  it('should track health history', async () => {
    const monitor = new ProviderHealthMonitor({
      checkIntervalMs: 60000,
      unhealthyThreshold: 3,
      degradedThresholdMs: 500,
      healthyThresholdMs: 200,
    });

    const provider = createMockProvider(true, 100);
    await monitor.checkProvider(provider);
    await monitor.checkProvider(provider);

    const history = monitor.getHistory('test-provider');
    expect(history).toHaveLength(2);
  });
});

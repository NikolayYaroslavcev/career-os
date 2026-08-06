import { describe, it, expect, beforeEach } from 'vitest';
import { NoopLogger, InMemoryMetricsCollector } from '@careeros/providers';
import { DiscoveryBulkIngestService, type DiscoveryIntakeProbe } from '../discovery-bulk-ingest-service.js';
import { DiscoverySourceRegistry } from '../../registry/discovery-source-registry.js';
import type { DiscoverySourceConfigData, DiscoverySourceConfigRepository } from '../discovery-source-config-repository.js';
import type { DiscoveryCursor, DiscoveryFetchResult, DiscoverySourceFetcher, RawCompanyTuple } from '../../types.js';

class FakeConfigRepository implements DiscoverySourceConfigRepository {
  private readonly rows = new Map<string, DiscoverySourceConfigData>();

  seed(row: DiscoverySourceConfigData): void {
    this.rows.set(row.sourceId, row);
  }

  async findBySourceId(sourceId: string): Promise<DiscoverySourceConfigData | null> {
    return this.rows.get(sourceId) ?? null;
  }

  async findAllEnabled(): Promise<readonly DiscoverySourceConfigData[]> {
    return [...this.rows.values()].filter((r) => r.enabled);
  }

  async findAll(): Promise<readonly DiscoverySourceConfigData[]> {
    return [...this.rows.values()];
  }

  async update(data: DiscoverySourceConfigData): Promise<DiscoverySourceConfigData> {
    this.rows.set(data.sourceId, data);
    return data;
  }

  async ensureRegistered(sourceId: string): Promise<DiscoverySourceConfigData> {
    const existing = this.rows.get(sourceId);
    if (existing) return existing;
    const created = baseConfig({ sourceId: sourceId as DiscoverySourceConfigData['sourceId'] });
    this.rows.set(sourceId, created);
    return created;
  }
}

function baseConfig(overrides: Partial<DiscoverySourceConfigData> = {}): DiscoverySourceConfigData {
  return {
    id: 'cfg-1',
    sourceId: 'cncf_landscape',
    enabled: true,
    cursor: null,
    lastRunAt: null,
    lastRunStatus: null,
    lastRunError: null,
    candidatesFound: 0,
    candidatesEnrolled: 0,
    candidatesRejected: 0,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class FakeFetcher implements DiscoverySourceFetcher {
  readonly id = 'cncf_landscape' as const;
  readonly defaultAuthorityScore = 70;
  constructor(private readonly result: DiscoveryFetchResult, private readonly shouldThrow = false) {}
  async fetch(_cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult> {
    if (this.shouldThrow) throw new Error('source unreachable');
    return this.result;
  }
}

function tuple(overrides: Partial<RawCompanyTuple> = {}): RawCompanyTuple {
  return { name: 'Acme', url: 'https://acme.example', sourceAuthorityScore: 70, ...overrides };
}

describe('DiscoveryBulkIngestService', () => {
  let configRepo: FakeConfigRepository;
  let registry: DiscoverySourceRegistry;

  beforeEach(() => {
    configRepo = new FakeConfigRepository();
    registry = new DiscoverySourceRegistry();
  });

  it('feeds every fetched tuple through the intake probe and tallies enrolled/rejected/deduplicated outcomes', async () => {
    configRepo.seed(baseConfig());
    registry.register(
      new FakeFetcher({
        tuples: [tuple({ name: 'Acme' }), tuple({ name: 'Dupe' }), tuple({ name: 'BadCo' })],
        cursor: { itemIndex: 3 },
        hasMore: false,
      })
    );

    const intake: DiscoveryIntakeProbe = {
      discover: async (input) => {
        if (input.companyName === 'Dupe') return { outcome: 'DUPLICATE' };
        if (input.companyName === 'BadCo') return { outcome: 'SCORED', candidate: { status: 'REJECTED' } };
        return { outcome: 'SCORED', candidate: { status: 'AUTO_APPROVED' } };
      },
    };

    const metrics = new InMemoryMetricsCollector();
    const service = new DiscoveryBulkIngestService(registry, configRepo, intake, new NoopLogger(), metrics);

    const result = await service.runSource('cncf_landscape');

    expect(result).toMatchObject({ found: 3, deduplicated: 1, enrolled: 1, rejected: 1, hasMore: false });
    expect(metrics.getCounter('careeros.discovery.candidates_found')).toBe(3);
    expect(metrics.getCounter('careeros.discovery.candidates_deduplicated')).toBe(1);
    expect(metrics.getCounter('careeros.discovery.auto_enrolled')).toBe(1);
    expect(metrics.getCounter('careeros.discovery.rejected')).toBe(1);

    const updatedConfig = await configRepo.findBySourceId('cncf_landscape');
    expect(updatedConfig?.cursor).toEqual({ itemIndex: 3 });
    expect(updatedConfig?.lastRunStatus).toBe('success');
    expect(updatedConfig?.candidatesFound).toBe(3);
  });

  it('skips a disabled source without calling its fetcher', async () => {
    configRepo.seed(baseConfig({ enabled: false }));
    const fetcher = new FakeFetcher({ tuples: [], cursor: null, hasMore: false });
    registry.register(fetcher);

    let called = false;
    fetcher.fetch = async () => {
      called = true;
      return { tuples: [], cursor: null, hasMore: false };
    };

    const service = new DiscoveryBulkIngestService(
      registry,
      configRepo,
      { discover: async () => ({ outcome: 'DUPLICATE' }) },
      new NoopLogger(),
      new InMemoryMetricsCollector()
    );

    const result = await service.runSource('cncf_landscape');
    expect(result.skipped).toBe(true);
    expect(called).toBe(false);
  });

  it('does not advance the cursor when the fetcher throws (ADR-035 §13: failed run must not lose the watermark)', async () => {
    const startingCursor = { itemIndex: 42 };
    configRepo.seed(baseConfig({ cursor: startingCursor }));
    registry.register(new FakeFetcher({ tuples: [], cursor: null, hasMore: false }, true));

    const service = new DiscoveryBulkIngestService(
      registry,
      configRepo,
      { discover: async () => ({ outcome: 'DUPLICATE' }) },
      new NoopLogger(),
      new InMemoryMetricsCollector()
    );

    const result = await service.runSource('cncf_landscape');
    expect(result.error).toContain('source unreachable');

    const updatedConfig = await configRepo.findBySourceId('cncf_landscape');
    expect(updatedConfig?.cursor).toEqual(startingCursor);
    expect(updatedConfig?.lastRunStatus).toBe('failed');
  });
});

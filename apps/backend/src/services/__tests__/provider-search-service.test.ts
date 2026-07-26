import { describe, it, expect } from 'vitest';
import {
  ProviderRegistry,
  FakeProvider,
  NoopLogger as ProviderNoopLogger,
  InMemoryMetricsCollector as ProviderInMemoryMetricsCollector,
  ProviderHealthMonitor,
} from '@careeros/providers';
import type { ProviderResult, SearchResult } from '@careeros/providers';
import { ProviderSearchService } from '../provider-search-service.js';
import { ProviderDiagnosticsService } from '../provider-diagnostics-service.js';
import { InMemoryVacancyRepository, InMemoryVacancySourceRepository, InMemoryCompanyRepository } from '../../testing/in-memory-repositories.js';
import { buildFixtureSearchProfile } from '../../testing/fixtures.js';

/** A provider whose search() never resolves, to exercise the per-provider timeout. */
class HangingProvider extends FakeProvider {
  override async search(): Promise<ProviderResult<SearchResult>> {
    return new Promise(() => {});
  }
}

describe('ProviderSearchService — resilient multi-provider search', () => {
  it('searches every registered provider in parallel and combines their results', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('greenhouse', { jobsToReturn: 2 }));
    registry.register(new FakeProvider('lever', { jobsToReturn: 3 }));

    const service = new ProviderSearchService(
      registry,
      new InMemoryVacancyRepository(),
      new InMemoryVacancySourceRepository(),
      new InMemoryCompanyRepository(),
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector()
    );

    const outcome = await service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1');

    expect([...outcome.stats.providerIds].sort()).toEqual(['greenhouse', 'lever']);
    expect(outcome.stats.fetched).toBe(5);
    // FakeProvider's fixture jobs collide on contentHash across providers by
    // sourceId (job-0/job-1 overlap between the 2-job and 3-job responses),
    // so cross-provider dedup collapses 5 fetched down to 3 unique.
    expect(outcome.stats.persisted).toBe(3);
    expect(outcome.stats.perProvider.every((p) => p.ok)).toBe(true);
  });

  it('keeps results from healthy providers when one provider is down (network error)', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('greenhouse', { fetchResult: 'network_error' }));
    registry.register(new FakeProvider('lever', { jobsToReturn: 3 }));

    const service = new ProviderSearchService(
      registry,
      new InMemoryVacancyRepository(),
      new InMemoryVacancySourceRepository(),
      new InMemoryCompanyRepository(),
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector()
    );

    const outcome = await service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1');

    expect(outcome.stats.fetched).toBe(3);
    expect(outcome.stats.persisted).toBe(3);

    const greenhouseStats = outcome.stats.perProvider.find((p) => p.providerId === 'greenhouse');
    const leverStats = outcome.stats.perProvider.find((p) => p.providerId === 'lever');
    expect(greenhouseStats?.ok).toBe(false);
    expect(greenhouseStats?.error).toBeTruthy();
    expect(leverStats?.ok).toBe(true);
    expect(leverStats?.fetched).toBe(3);
  });

  it('keeps results from healthy providers when one provider returns a server error (simulated Workday 500)', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('workday', { fetchResult: 'malformed' }));
    registry.register(new FakeProvider('ashby', { jobsToReturn: 2 }));
    registry.register(new FakeProvider('teamtailor', { jobsToReturn: 1 }));

    const service = new ProviderSearchService(
      registry,
      new InMemoryVacancyRepository(),
      new InMemoryVacancySourceRepository(),
      new InMemoryCompanyRepository(),
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector()
    );

    const outcome = await service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1');

    expect(outcome.stats.fetched).toBe(3);
    expect(outcome.stats.perProvider).toHaveLength(3);
    expect(outcome.stats.perProvider.filter((p) => p.ok)).toHaveLength(2);
    expect(outcome.stats.perProvider.filter((p) => !p.ok)).toHaveLength(1);
  });

  it('does not let one provider hanging past its timeout block results from the others', async () => {
    const registry = new ProviderRegistry();
    registry.register(new HangingProvider('greenhouse'));
    registry.register(new FakeProvider('lever', { jobsToReturn: 2 }));

    // Short timeout so the test doesn't wait for the real default (15s).
    const service = new ProviderSearchService(
      registry,
      new InMemoryVacancyRepository(),
      new InMemoryVacancySourceRepository(),
      new InMemoryCompanyRepository(),
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector(),
      50
    );

    const outcome = await service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1');

    expect(outcome.stats.fetched).toBe(2);
    expect(outcome.stats.persisted).toBe(2);

    const hungStats = outcome.stats.perProvider.find((p) => p.providerId === 'greenhouse');
    expect(hungStats?.ok).toBe(false);
    expect(hungStats?.timedOut).toBe(true);
  });

  it('throws only when every provider fails', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('greenhouse', { fetchResult: 'network_error' }));
    registry.register(new FakeProvider('lever', { fetchResult: 'rate_limited' }));

    const service = new ProviderSearchService(
      registry,
      new InMemoryVacancyRepository(),
      new InMemoryVacancySourceRepository(),
      new InMemoryCompanyRepository(),
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector()
    );

    await expect(service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1')).rejects.toThrow(
      'All providers failed during search'
    );
  });

  it('deduplicates vacancies that resolve to the same content hash across providers', async () => {
    const registry = new ProviderRegistry();
    // Two providers returning FakeProvider's identical fixture jobs (same
    // sourceId/title/company/url shape) collide on contentHash cross-provider.
    registry.register(new FakeProvider('greenhouse', { jobsToReturn: 2 }));
    registry.register(new FakeProvider('lever', { jobsToReturn: 2 }));

    const service = new ProviderSearchService(
      registry,
      new InMemoryVacancyRepository(),
      new InMemoryVacancySourceRepository(),
      new InMemoryCompanyRepository(),
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector()
    );

    const outcome = await service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1');

    // FakeProvider's FakeNormalizer hashes by `hash-${sourceId}` (not
    // provider-qualified), so job-0/job-1 from both providers collide —
    // fetched counts both, persisted reflects the deduplicated set.
    expect(outcome.stats.fetched).toBe(4);
    expect(outcome.stats.persisted).toBe(2);
  });

  it('records per-provider fetch diagnostics (EPIC-17 Part 3) when a diagnostics service is supplied', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('greenhouse', { jobsToReturn: 2 }));
    registry.register(new FakeProvider('lever', { fetchResult: 'network_error' }));

    const diagnostics = new ProviderDiagnosticsService(new ProviderHealthMonitor({
      checkIntervalMs: 60_000,
      unhealthyThreshold: 3,
      degradedThresholdMs: 3000,
      healthyThresholdMs: 1000,
    }));
    diagnostics.recordRegistrations([
      { providerId: 'greenhouse', registered: true, configured: true, authenticated: 'configured' },
      { providerId: 'lever', registered: true, configured: true, authenticated: 'not_required' },
    ]);

    const service = new ProviderSearchService(
      registry,
      new InMemoryVacancyRepository(),
      new InMemoryVacancySourceRepository(),
      new InMemoryCompanyRepository(),
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector(),
      15_000,
      50,
      1,
      diagnostics
    );

    await service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1');

    const snapshot = diagnostics.getSnapshot();
    const greenhouse = snapshot.find((p) => p.providerId === 'greenhouse');
    const lever = snapshot.find((p) => p.providerId === 'lever');

    expect(greenhouse?.lastFetch?.ok).toBe(true);
    expect(greenhouse?.lastFetch?.fetchedCount).toBe(2);
    expect(greenhouse?.lastFetch?.persistedCount).toBe(2);
    expect(greenhouse?.lastFetch?.parseFailureCount).toBe(0);

    expect(lever?.lastFetch?.ok).toBe(false);
    expect(lever?.lastFetch?.error).toBeTruthy();
    expect(lever?.lastFetch?.persistedCount).toBe(0);
  });

  it('persists a VacancySource record for each newly-created vacancy, linking it back to the source provider', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('greenhouse', { jobsToReturn: 2 }));

    const vacancySourceRepository = new InMemoryVacancySourceRepository();
    const service = new ProviderSearchService(
      registry,
      new InMemoryVacancyRepository(),
      vacancySourceRepository,
      new InMemoryCompanyRepository(),
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector()
    );

    const outcome = await service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1');

    expect(outcome.stats.persisted).toBe(2);
    for (const vacancy of outcome.vacancies) {
      const sources = await vacancySourceRepository.findByVacancyId(vacancy.id);
      expect(sources).toHaveLength(1);
      expect(sources[0]).toMatchObject({
        vacancyId: vacancy.id,
        providerId: 'greenhouse',
        isPrimary: true,
      });
      expect(sources[0]?.externalId).toMatch(/^job-\d+$/);
    }
  });

  it('reuses the existing vacancy on a second search instead of creating a duplicate, keyed by provider + externalId', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('greenhouse', { jobsToReturn: 2 }));

    const vacancyRepository = new InMemoryVacancyRepository();
    const vacancySourceRepository = new InMemoryVacancySourceRepository();
    const service = new ProviderSearchService(
      registry,
      vacancyRepository,
      vacancySourceRepository,
      new InMemoryCompanyRepository(),
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector()
    );

    const first = await service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1');
    expect(first.stats.persisted).toBe(2);
    expect(first.stats.reused).toBe(0);

    const second = await service.searchAndPersist(buildFixtureSearchProfile(), undefined, 'workspace-1');

    // Same two jobs come back from the fake provider on the second call — both
    // should resolve to the already-persisted vacancies via their VacancySource,
    // not create new ones.
    expect(second.stats.persisted).toBe(2);
    expect(second.stats.reused).toBe(2);
    expect(second.vacancies.map((v) => v.id).sort()).toEqual(first.vacancies.map((v) => v.id).sort());

    const allSources = await Promise.all(second.vacancies.map((v) => vacancySourceRepository.findByVacancyId(v.id)));
    expect(allSources.every((sources) => sources.length === 1)).toBe(true);
  });
});

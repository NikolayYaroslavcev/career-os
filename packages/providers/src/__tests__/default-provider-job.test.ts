import { describe, it, expect, vi } from 'vitest';
import { DefaultProviderJob } from '../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../interfaces/default-sync-strategy.js';
import type { Fetcher, FetchResult } from '../interfaces/fetcher.js';
import type { Mapper, MappedJob } from '../interfaces/mapper.js';
import type { Normalizer, NormalizationError } from '../interfaces/normalizer.js';
import type { NormalizedVacancy } from '../interfaces/normalized-vacancy.js';
import type { ProviderResult, ResultMeta } from '../interfaces/result.js';
import type { RawJob } from '../interfaces/raw-job.js';
import type { SearchCriteria } from '../interfaces/search-criteria.js';
import type { SyncCursor } from '../interfaces/sync-cursor.js';
import type { ProviderInfo } from '../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../interfaces/provider-capabilities.js';
import { ProviderErrorType } from '../errors/provider-errors.js';

function meta(): ResultMeta {
  return { durationMs: 0 };
}

function rawJob(index: number): RawJob {
  return {
    sourceId: `job-${index}`,
    title: `Job ${index}`,
    description: 'desc',
    companyName: 'Acme',
    location: 'Remote',
    technologies: [],
    url: `https://example.com/${index}`,
    publishedAt: new Date('2024-01-01'),
    remote: true,
    fetchedAt: new Date(),
  };
}

/** Fetcher whose success/failure is toggled per test to drive DefaultProviderJob.sync() down both branches. */
class ControllableFetcher implements Fetcher {
  shouldFail = false;
  jobCount = 3;

  async search(): Promise<ProviderResult<RawJob[]>> {
    return { ok: true, data: [], meta: meta() };
  }

  async fetchWithCursor(_criteria: SearchCriteria, _cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    if (this.shouldFail) {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'boom', retryable: true, meta: meta() };
    }
    const jobs = Array.from({ length: this.jobCount }, (_, i) => rawJob(i));
    return {
      ok: true,
      data: {
        jobs,
        cursor: { cursor: { type: 'none', message: 'Done' }, strategy: 'none', exhausted: true, fetchedCount: jobs.length },
        hasMore: false,
        meta: {},
      },
      meta: meta(),
    };
  }

  async getVacancy(): Promise<ProviderResult<RawJob | null>> {
    return { ok: true, data: null, meta: meta() };
  }

  async ping(): Promise<ProviderResult<boolean>> {
    return { ok: true, data: true, meta: meta() };
  }
}

class PassthroughMapper implements Mapper {
  readonly providerId = 'test';

  map(raw: RawJob): MappedJob {
    return {
      sourceId: raw.sourceId,
      title: raw.title,
      description: raw.description,
      companyName: raw.companyName,
      location: { raw: raw.location },
      technologies: [...raw.technologies],
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
    };
  }
}

class PassthroughNormalizer implements Normalizer {
  readonly providerId = 'test';

  validate(_job: MappedJob): NormalizationError | null {
    return null;
  }

  normalize(job: MappedJob): NormalizedVacancy {
    return {
      id: `test:${job.sourceId}`,
      source: 'test',
      sourceId: job.sourceId,
      title: job.title,
      description: job.description,
      companyName: job.companyName,
      location: { raw: job.location.raw, remoteEligible: true },
      technologies: [...job.technologies],
      url: job.url,
      publishedAt: job.publishedAt,
      fetchedAt: job.fetchedAt,
      remote: { level: job.remote ? 'remote_only' : 'unknown', explicit: true },
      normalizedAt: new Date(),
      contentHash: `hash-${job.sourceId}`,
    };
  }
}

const PROVIDER_INFO: ProviderInfo = {
  id: 'test',
  name: 'Test Provider',
  version: '1.0.0',
  supportedCountries: ['US'],
  supportedLanguages: ['en'],
  auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: true },
  supportsRemote: true,
  baseUrl: 'https://example.com',
};

const CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 100, supportsKeyword: true, supportsLocation: true, supportsTechnology: true },
  pagination: { strategy: 'none', maxPageSize: 100, defaultPageSize: 20 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 0 },
  filtering: { experienceLevels: [], salaryFilter: true, remoteFilter: true, technologyFilter: true, dateFilter: true },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 10, fullDescription: true, salaryData: false, companyDetails: false },
};

function createJob(fetcher: ControllableFetcher): DefaultProviderJob {
  return new DefaultProviderJob(
    PROVIDER_INFO,
    CAPABILITIES,
    fetcher,
    new PassthroughMapper(),
    new PassthroughNormalizer(),
    new DefaultSyncStrategy('test'),
  );
}

describe('DefaultProviderJob runtime state', () => {
  it('applies stateUpdates from a successful sync onto job.state', async () => {
    const fetcher = new ControllableFetcher();
    fetcher.jobCount = 4;
    const job = createJob(fetcher);

    const result = await job.sync();

    expect(result.ok).toBe(true);
    expect(job.state.importedCount).toBe(4);
    expect(job.state.lastSync).not.toBeNull();
    expect(job.state.consecutiveSuccesses).toBe(1);
    expect(job.state.consecutiveFailures).toBe(0);
  });

  it('increments consecutiveFailures and records lastError on a failed sync', async () => {
    const fetcher = new ControllableFetcher();
    fetcher.shouldFail = true;
    const job = createJob(fetcher);

    const result = await job.sync();

    expect(result.ok).toBe(false);
    expect(job.state.consecutiveFailures).toBe(1);
    expect(job.state.consecutiveSuccesses).toBe(0);
    expect(job.state.lastError).toBe('boom');
  });

  it('resets consecutiveFailures once a sync succeeds after prior failures', async () => {
    const fetcher = new ControllableFetcher();
    fetcher.shouldFail = true;
    const job = createJob(fetcher);

    await job.sync();
    await job.sync();
    expect(job.state.consecutiveFailures).toBe(2);

    fetcher.shouldFail = false;
    await job.sync();

    expect(job.state.consecutiveFailures).toBe(0);
    expect(job.state.consecutiveSuccesses).toBe(1);
  });

  it('accumulates importedCount across successive syncs', async () => {
    const fetcher = new ControllableFetcher();
    fetcher.jobCount = 2;
    const job = createJob(fetcher);

    await job.sync();
    await job.sync();

    expect(job.state.importedCount).toBe(4);
  });

  it('accumulates failedCount across successive failed syncs', async () => {
    const fetcher = new ControllableFetcher();
    fetcher.shouldFail = true;
    const job = createJob(fetcher);

    await job.sync();
    await job.sync();

    expect(job.state.failedCount).toBe(2);
  });

  it('updates lastError to the most recent failure message', async () => {
    const fetcher = new ControllableFetcher();
    fetcher.shouldFail = true;
    const job = createJob(fetcher);

    await job.sync();
    expect(job.state.lastError).toBe('boom');
  });

  it('blocks sync via the circuit breaker once consecutiveFailures crosses the threshold', async () => {
    const fetcher = new ControllableFetcher();
    fetcher.shouldFail = true;
    const job = createJob(fetcher);

    await job.sync();
    await job.sync();
    await job.sync();
    expect(job.state.consecutiveFailures).toBe(3);

    const fetchSpy = vi.spyOn(fetcher, 'fetchWithCursor');
    const blockedResult = await job.sync();

    expect(blockedResult.ok).toBe(true);
    expect(blockedResult.ok && blockedResult.data.shouldContinue).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    // State is unchanged by a blocked sync attempt.
    expect(job.state.consecutiveFailures).toBe(3);
  });

  it('allows sync to execute again once a run succeeds after a below-threshold failure streak', async () => {
    const fetcher = new ControllableFetcher();
    fetcher.shouldFail = true;
    const job = createJob(fetcher);

    await job.sync();
    await job.sync();
    expect(job.state.consecutiveFailures).toBe(2);

    fetcher.shouldFail = false;
    const fetchSpy = vi.spyOn(fetcher, 'fetchWithCursor');
    const recovered = await job.sync();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(recovered.ok).toBe(true);
    expect(job.state.consecutiveFailures).toBe(0);
  });
});

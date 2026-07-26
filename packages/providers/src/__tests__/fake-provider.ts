import type { ProviderInfo } from '../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../interfaces/provider-capabilities.js';
import type { ProviderState } from '../interfaces/provider-state.js';
import type { ProviderResult, ResultMeta } from '../interfaces/result.js';
import type { NormalizedVacancy } from '../interfaces/normalized-vacancy.js';
import type { SearchCriteria } from '../interfaces/search-criteria.js';
import type { CursorState, SyncCursor } from '../interfaces/sync-cursor.js';
import type { Fetcher, FetchResult } from '../interfaces/fetcher.js';
import type { Mapper, MappedJob } from '../interfaces/mapper.js';
import type { Normalizer, NormalizationError } from '../interfaces/normalizer.js';
import type { RawJob } from '../interfaces/raw-job.js';
import type { SyncStrategy, SyncStrategyResult } from '../interfaces/sync-strategy.js';
import type { ProviderJob, ProviderConfig, SearchResult, SyncResult, ProviderHealthCheckResult } from '../interfaces/provider-job.js';
import { ProviderErrorType } from '../errors/provider-errors.js';
import { createInitialState } from '../interfaces/provider-state.js';
import { createInitialCursor, advanceCursor } from '../interfaces/sync-cursor.js';

export type FakeProviderBehavior = {
  readonly fetchResult?: 'success' | 'timeout' | 'network_error' | 'rate_limited' | 'malformed' | 'partial';
  readonly healthResult?: 'healthy' | 'unhealthy' | 'degraded';
  readonly latencyMs?: number;
  readonly jobsToReturn?: number;
  readonly duplicateRate?: number;
};

function makeMeta(durationMs: number): ResultMeta {
  return { durationMs };
}

function createFakeRawJob(index: number): RawJob {
  return {
    sourceId: `job-${index}`,
    title: `Software Engineer ${index}`,
    description: `Description for job ${index}`,
    companyName: `Company ${index}`,
    location: 'Remote',
    technologies: ['typescript', 'react'],
    url: `https://example.com/job/${index}`,
    publishedAt: new Date('2024-01-01'),
    remote: true,
    fetchedAt: new Date(),
  };
}

class FakeFetcher implements Fetcher {
  constructor(
    private readonly providerId: string,
    private readonly behavior: FakeProviderBehavior,
  ) {}

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    return this.simulateFetch();
  }

  async getVacancy(_sourceId: string): Promise<ProviderResult<RawJob | null>> {
    if (this.behavior.fetchResult === 'timeout') {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Timeout', retryable: true, meta: makeMeta(0) };
    }
    if (this.behavior.fetchResult === 'network_error') {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Connection refused', retryable: true, meta: makeMeta(0) };
    }
    if (this.behavior.fetchResult === 'rate_limited') {
      return { ok: false, error: ProviderErrorType.RATE_LIMITED, message: 'Rate limited', retryable: true, meta: makeMeta(0) };
    }
    if (this.behavior.fetchResult === 'malformed') {
      return { ok: false, error: ProviderErrorType.INVALID_RESPONSE, message: 'Invalid JSON', retryable: false, meta: makeMeta(0) };
    }
    return { ok: true, data: createFakeRawJob(0), meta: makeMeta(this.behavior.latencyMs ?? 10) };
  }

  async fetchWithCursor(_criteria: SearchCriteria, _cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    if (this.behavior.fetchResult === 'timeout') {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Timeout', retryable: true, meta: makeMeta(0) };
    }
    if (this.behavior.fetchResult === 'network_error') {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Connection refused', retryable: true, meta: makeMeta(0) };
    }
    if (this.behavior.fetchResult === 'rate_limited') {
      return { ok: false, error: ProviderErrorType.RATE_LIMITED, message: 'Rate limited', retryable: true, meta: makeMeta(0) };
    }
    if (this.behavior.fetchResult === 'malformed') {
      return { ok: false, error: ProviderErrorType.INVALID_RESPONSE, message: 'Invalid JSON', retryable: false, meta: makeMeta(0) };
    }

    const count = this.behavior.jobsToReturn ?? 10;
    const jobs: RawJob[] = [];
    for (let i = 0; i < count; i++) {
      jobs.push(createFakeRawJob(i));
    }

    if (this.behavior.duplicateRate && this.behavior.duplicateRate > 0) {
      const dupCount = Math.floor(count * this.behavior.duplicateRate);
      for (let i = 0; i < dupCount; i++) {
        jobs.push(createFakeRawJob(i));
      }
    }

    const fetchResult: FetchResult = {
      jobs,
      cursor: { cursor: { type: 'none', message: 'Done' }, strategy: 'none', exhausted: true, fetchedCount: jobs.length },
      hasMore: false,
      meta: {},
    };

    return { ok: true, data: fetchResult, meta: makeMeta(this.behavior.latencyMs ?? 10) };
  }

  async ping(): Promise<ProviderResult<boolean>> {
    if (this.behavior.healthResult === 'unhealthy') {
      return { ok: true, data: false, meta: makeMeta(this.behavior.latencyMs ?? 10) };
    }
    return { ok: true, data: true, meta: makeMeta(this.behavior.latencyMs ?? 10) };
  }

  private async simulateFetch(): Promise<ProviderResult<RawJob[]>> {
    if (this.behavior.fetchResult === 'timeout') {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Timeout', retryable: true, meta: makeMeta(0) };
    }
    if (this.behavior.fetchResult === 'network_error') {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Connection refused', retryable: true, meta: makeMeta(0) };
    }
    if (this.behavior.fetchResult === 'rate_limited') {
      return { ok: false, error: ProviderErrorType.RATE_LIMITED, message: 'Rate limited', retryable: true, meta: makeMeta(0) };
    }
    if (this.behavior.fetchResult === 'malformed') {
      return { ok: false, error: ProviderErrorType.INVALID_RESPONSE, message: 'Invalid JSON', retryable: false, meta: makeMeta(0) };
    }

    const count = this.behavior.jobsToReturn ?? 10;
    const jobs: RawJob[] = [];
    for (let i = 0; i < count; i++) {
      jobs.push(createFakeRawJob(i));
    }
    return { ok: true, data: jobs, meta: makeMeta(this.behavior.latencyMs ?? 10) };
  }
}

class FakeMapper implements Mapper {
  constructor(readonly providerId: string) {}

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

class FakeNormalizer implements Normalizer {
  constructor(readonly providerId: string) {}

  normalize(job: MappedJob): NormalizedVacancy {
    return {
      id: `${this.providerId}:${job.sourceId}`,
      source: this.providerId,
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

  validate(job: MappedJob): NormalizationError | null {
    if (!job.sourceId) return { field: 'sourceId', message: 'Missing', severity: 'error' };
    if (!job.title) return { field: 'title', message: 'Missing', severity: 'error' };
    return null;
  }
}

class FakeSyncStrategy implements SyncStrategy {
  constructor(readonly providerId: string) {}

  shouldSync(state: ProviderState): boolean {
    if (state.health === 'unhealthy') return false;
    if (state.consecutiveFailures >= 3) return false;
    return true;
  }

  getFullSyncCursor(): SyncCursor {
    return { type: 'none', message: 'No pagination' };
  }

  getIncrementalCursor(state: ProviderState): SyncCursor {
    return {
      type: 'timestamp',
      since: state.lastSync ?? new Date(0),
      inclusive: false,
    };
  }

  processResults(state: ProviderState, results: NormalizedVacancy[], _cursor: CursorState): SyncStrategyResult {
    return {
      stateUpdates: {
        providerId: this.providerId,
        changes: {
          lastSync: new Date(),
          importedCount: state.importedCount + results.length,
          consecutiveFailures: 0,
          consecutiveSuccesses: state.consecutiveSuccesses + 1,
        },
      },
      shouldContinue: false,
      metrics: {
        fetched: results.length,
        normalized: results.length,
        deduplicated: 0,
        imported: results.length,
        failed: 0,
        durationMs: 0,
      },
    };
  }
}

export class FakeProvider implements ProviderJob {
  readonly state: ProviderState;
  private _initialized = false;

  readonly info: ProviderInfo;
  readonly capabilities: ProviderCapabilities;
  readonly fetcher: Fetcher;
  readonly mapper: Mapper;
  readonly normalizer: Normalizer;
  readonly syncStrategy: SyncStrategy;

  constructor(id: string, behavior: FakeProviderBehavior = {}) {
    this.info = {
      id,
      name: `Fake ${id}`,
      version: '1.0.0',
      supportedCountries: ['US'],
      supportedLanguages: ['en'],
      auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: true },
      supportsRemote: true,
      baseUrl: 'https://fake.example.com',
    };

    this.capabilities = {
      search: { supported: true, maxResults: 100, supportsKeyword: true, supportsLocation: true, supportsTechnology: true },
      pagination: { strategy: 'none', maxPageSize: 100, defaultPageSize: 20 },
      sync: { incremental: true, fullSync: true, minSyncIntervalMs: 3600000 },
      filtering: { experienceLevels: [], salaryFilter: true, remoteFilter: true, technologyFilter: true, dateFilter: true },
      rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
      characteristics: { avgResponseTimeMs: 100, fullDescription: true, salaryData: false, companyDetails: false },
    };

    this.state = createInitialState(id);
    this.fetcher = new FakeFetcher(id, behavior);
    this.mapper = new FakeMapper(id);
    this.normalizer = new FakeNormalizer(id);
    this.syncStrategy = new FakeSyncStrategy(id);
  }

  async initialize(_config: ProviderConfig): Promise<void> {
    this._initialized = true;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<SearchResult>> {
    const cursorState = createInitialCursor(this.capabilities.pagination.strategy);
    const fetchResult = await this.fetcher.fetchWithCursor(criteria, cursorState.cursor);
    if (!fetchResult.ok) return fetchResult;

    const mapped = fetchResult.data.jobs.map((raw) => this.mapper.map(raw));
    const succeeded: NormalizedVacancy[] = [];
    const failed: Array<{ sourceId: string; reason: string }> = [];

    for (const job of mapped) {
      const error = this.normalizer.validate(job);
      if (error && error.severity === 'error') {
        failed.push({ sourceId: job.sourceId, reason: error.message });
        continue;
      }
      succeeded.push(this.normalizer.normalize(job));
    }

    const newCursor = advanceCursor(fetchResult.data.cursor, {
      count: succeeded.length,
      hasMore: fetchResult.data.hasMore,
    });

    return {
      ok: true,
      data: {
        vacancies: succeeded,
        cursor: newCursor,
        normalization: {
          succeeded: [...succeeded],
          failed: failed.map((f) => ({ sourceId: f.sourceId, reason: f.reason })),
          stats: { total: mapped.length, succeeded: succeeded.length, failed: failed.length, durationMs: fetchResult.meta.durationMs as number },
        },
      },
      meta: fetchResult.meta,
    };
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<NormalizedVacancy | null>> {
    const result = await this.fetcher.getVacancy(sourceId);
    if (!result.ok) return result;
    if (!result.data) return { ok: true, data: null, meta: result.meta };
    const mapped = this.mapper.map(result.data);
    const error = this.normalizer.validate(mapped);
    if (error && error.severity === 'error') {
      return { ok: false, error: ProviderErrorType.INVALID_RESPONSE, message: error.message, retryable: false, meta: result.meta };
    }
    return { ok: true, data: this.normalizer.normalize(mapped), meta: result.meta };
  }

  async sync(): Promise<ProviderResult<SyncResult>> {
    const cursor = this.syncStrategy.getIncrementalCursor(this.state);
    const searchResult = await this.search({ cursor, limit: this.capabilities.pagination.defaultPageSize });
    if (!searchResult.ok) return searchResult;

    const syncResult = this.syncStrategy.processResults(
      this.state,
      [...searchResult.data.vacancies],
      searchResult.data.cursor,
    );

    return {
      ok: true,
      data: {
        imported: searchResult.data.vacancies,
        stateUpdates: syncResult.stateUpdates,
        metrics: syncResult.metrics,
        shouldContinue: syncResult.shouldContinue,
      },
      meta: searchResult.meta,
    };
  }

  async healthCheck(): Promise<ProviderHealthCheckResult> {
    const start = Date.now();
    const result = await this.fetcher.ping();
    const latencyMs = Date.now() - start;
    if (!result.ok) return { healthy: false, latencyMs, message: result.message };
    return { healthy: result.data, latencyMs };
  }

  async dispose(): Promise<void> {
    this._initialized = false;
  }
}

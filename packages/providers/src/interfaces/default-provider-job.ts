import type { ProviderInfo } from './provider-info.js';
import type { ProviderCapabilities } from './provider-capabilities.js';
import type { ProviderState, ProviderStateUpdate } from './provider-state.js';
import type { ProviderResult } from './result.js';
import type { NormalizedVacancy } from './normalized-vacancy.js';
import type { SearchCriteria } from './search-criteria.js';
import type { ProviderJob, ProviderConfig, SearchResult, SyncResult, ProviderHealthCheckResult } from './provider-job.js';
import type { Fetcher } from './fetcher.js';
import type { Mapper } from './mapper.js';
import type { Normalizer } from './normalizer.js';
import type { SyncStrategy } from './sync-strategy.js';
import { ProviderErrorType } from '../errors/provider-errors.js';
import { createInitialState } from './provider-state.js';
import { createInitialCursor, advanceCursor } from './sync-cursor.js';

export class DefaultProviderJob implements ProviderJob {
  private _state: ProviderState;
  private _initialized = false;

  get state(): ProviderState {
    return this._state;
  }

  constructor(
    readonly info: ProviderInfo,
    readonly capabilities: ProviderCapabilities,
    readonly fetcher: Fetcher,
    readonly mapper: Mapper,
    readonly normalizer: Normalizer,
    readonly syncStrategy: SyncStrategy,
    /**
     * Criteria merged into every scheduled sync() search. Providers whose
     * fetcher requires an explicit keyword/location to return results (e.g.
     * LinkedIn's guest search, which returns an empty page rather than an
     * error when called with none) set this; providers with an inherently
     * scoped feed (niche job boards, single-tenant ATS) leave it undefined.
     */
    private readonly defaultSyncCriteria?: Partial<SearchCriteria>,
  ) {
    this._state = createInitialState(info.id);
  }

  /** Applies a strategy's reported changes to the job's own runtime state, so shouldSync() next sees fresh values instead of the frozen initial state. */
  private applyStateUpdate(update: ProviderStateUpdate): void {
    this._state = { ...this._state, ...update.changes, updatedAt: new Date() };
  }

  async initialize(_config: ProviderConfig): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<SearchResult>> {
    const cursorState = criteria.cursor
      ? { cursor: criteria.cursor, strategy: this.capabilities.pagination.strategy, exhausted: false, fetchedCount: 0 }
      : createInitialCursor(
          this.capabilities.pagination.strategy,
          { pageSize: criteria.limit ?? this.capabilities.pagination.defaultPageSize },
        );

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
          failed: failed.map((f) => ({
            sourceId: f.sourceId,
            reason: f.reason,
          })),
          stats: {
            total: mapped.length,
            succeeded: succeeded.length,
            failed: failed.length,
            durationMs: fetchResult.meta.durationMs as number,
          },
        },
      },
      meta: fetchResult.meta,
    };
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<NormalizedVacancy | null>> {
    const fetchResult = await this.fetcher.getVacancy(sourceId);
    if (!fetchResult.ok) return fetchResult;

    if (!fetchResult.data) {
      return { ok: true, data: null, meta: fetchResult.meta };
    }

    const mapped = this.mapper.map(fetchResult.data);
    const error = this.normalizer.validate(mapped);

    if (error && error.severity === 'error') {
      return {
        ok: false,
        error: ProviderErrorType.INVALID_RESPONSE,
        message: error.message,
        retryable: false,
        meta: fetchResult.meta,
      };
    }

    return {
      ok: true,
      data: this.normalizer.normalize(mapped),
      meta: fetchResult.meta,
    };
  }

  async sync(): Promise<ProviderResult<SyncResult>> {
    if (!this.syncStrategy.shouldSync(this.state)) {
      return {
        ok: true,
        data: {
          imported: [],
          stateUpdates: { providerId: this.info.id, changes: {} },
          metrics: { fetched: 0, normalized: 0, deduplicated: 0, imported: 0, failed: 0, durationMs: 0 },
          shouldContinue: false,
        },
        meta: { durationMs: 0 },
      };
    }

    const cursor = this.syncStrategy.getIncrementalCursor(this.state);
    const searchResult = await this.search({
      ...this.defaultSyncCriteria,
      cursor,
      limit: this.capabilities.pagination.defaultPageSize,
    });

    if (!searchResult.ok) {
      this.applyStateUpdate({
        providerId: this.info.id,
        changes: {
          consecutiveFailures: this.state.consecutiveFailures + 1,
          consecutiveSuccesses: 0,
          failedCount: this.state.failedCount + 1,
          lastError: searchResult.message,
          lastErrorAt: new Date(),
        },
      });

      return {
        ok: false,
        error: searchResult.error,
        message: searchResult.message,
        retryable: searchResult.retryable,
        meta: searchResult.meta,
      };
    }

    const syncResult = this.syncStrategy.processResults(
      this.state,
      [...searchResult.data.vacancies],
      searchResult.data.cursor,
    );

    this.applyStateUpdate(syncResult.stateUpdates);

    return {
      ok: true,
      data: {
        imported: searchResult.data.vacancies,
        stateUpdates: syncResult.stateUpdates,
        metrics: syncResult.metrics,
        shouldContinue: syncResult.shouldContinue,
        nextCursor: syncResult.nextCursor ? searchResult.data.cursor : undefined,
      },
      meta: searchResult.meta,
    };
  }

  async healthCheck(): Promise<ProviderHealthCheckResult> {
    const start = Date.now();
    const result = await this.fetcher.ping();
    const latencyMs = Date.now() - start;

    if (!result.ok) {
      return { healthy: false, latencyMs, message: result.message };
    }

    return { healthy: result.data, latencyMs };
  }

  async dispose(): Promise<void> {
    this._initialized = false;
  }
}

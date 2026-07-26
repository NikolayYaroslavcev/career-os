import type { ProviderState } from './provider-state.js';
import type { SyncCursor, CursorState } from './sync-cursor.js';
import type { NormalizedVacancy } from './normalized-vacancy.js';
import type { SyncStrategy, SyncStrategyResult } from './sync-strategy.js';

export class DefaultSyncStrategy implements SyncStrategy {
  constructor(
    readonly providerId: string,
    private readonly options: {
      readonly fullSyncPageSize?: number;
      readonly incrementalPageSize?: number;
      readonly maxSyncWindowMs?: number;
    } = {},
  ) {}

  shouldSync(state: ProviderState): boolean {
    if (state.health === 'unhealthy') return false;
    if (state.consecutiveFailures >= 3) return false;
    if (!state.nextSync) return true;
    return Date.now() >= state.nextSync.getTime();
  }

  getFullSyncCursor(): SyncCursor {
    return {
      type: 'page',
      page: 1,
      perPage: this.options.fullSyncPageSize ?? 20,
    };
  }

  getIncrementalCursor(state: ProviderState): SyncCursor {
    const since = state.lastSync ?? new Date(0);
    return {
      type: 'timestamp',
      since,
      inclusive: false,
      maxRangeMs: this.options.maxSyncWindowMs,
    };
  }

  processResults(
    state: ProviderState,
    results: NormalizedVacancy[],
    cursor: CursorState,
  ): SyncStrategyResult {
    const imported = results.length;
    const failed = 0;

    return {
      stateUpdates: {
        providerId: this.providerId,
        changes: {
          lastSync: new Date(),
          importedCount: state.importedCount + imported,
          failedCount: state.failedCount + failed,
          consecutiveFailures: 0,
          consecutiveSuccesses: state.consecutiveSuccesses + 1,
        },
      },
      shouldContinue: !cursor.exhausted,
      metrics: {
        fetched: cursor.fetchedCount,
        normalized: imported,
        deduplicated: 0,
        imported,
        failed,
        durationMs: 0,
      },
    };
  }
}

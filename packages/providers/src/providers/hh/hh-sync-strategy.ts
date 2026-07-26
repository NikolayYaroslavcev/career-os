import type { SyncStrategy, SyncStrategyResult } from '../../interfaces/sync-strategy.js';
import type { VacancySource } from '../../types/provider.js';
import type { ProviderState, ProviderStateUpdate } from '../../interfaces/provider-state.js';
import type { SyncCursor, CursorState } from '../../interfaces/sync-cursor.js';
import type { NormalizedVacancy } from '../../interfaces/normalized-vacancy.js';

export class HHSyncStrategy implements SyncStrategy {
  readonly providerId: VacancySource = 'hh';

  shouldSync(state: ProviderState): boolean {
    if (state.health === 'unhealthy') {
      return false;
    }

    if (state.consecutiveFailures >= 3) {
      return false;
    }

    if (!state.nextSync) {
      return true;
    }

    return Date.now() >= state.nextSync.getTime();
  }

  getFullSyncCursor(): SyncCursor {
    return {
      type: 'page',
      page: 0,
      perPage: 100,
    };
  }

  getIncrementalCursor(state: ProviderState): SyncCursor {
    const since = state.lastSync ?? new Date(0);
    return {
      type: 'timestamp',
      since,
      inclusive: false,
      maxRangeMs: 24 * 60 * 60 * 1000, // 24 hours
    };
  }

  processResults(
    state: ProviderState,
    results: NormalizedVacancy[],
    _cursor: CursorState,
  ): SyncStrategyResult {
    const imported = results.length;
    const failed = 0;

    const stateUpdates: ProviderStateUpdate = {
      providerId: this.providerId,
      changes: {
        lastSync: new Date(),
        importedCount: state.importedCount + imported,
        failedCount: state.failedCount + failed,
        consecutiveFailures: 0,
        consecutiveSuccesses: state.consecutiveSuccesses + 1,
      },
    };

    return {
      stateUpdates,
      shouldContinue: false,
      metrics: {
        fetched: results.length,
        normalized: imported,
        deduplicated: 0,
        imported,
        failed,
        durationMs: 0,
      },
    };
  }
}

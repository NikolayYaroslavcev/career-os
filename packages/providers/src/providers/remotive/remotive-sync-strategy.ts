import type { SyncStrategy, SyncStrategyResult } from '../../interfaces/sync-strategy.js';
import type { ProviderState, ProviderStateUpdate } from '../../interfaces/provider-state.js';
import type { SyncCursor, CursorState } from '../../interfaces/sync-cursor.js';
import type { NormalizedVacancy } from '../../interfaces/normalized-vacancy.js';
import type { VacancySource } from '../../types/provider.js';

export class RemotiveSyncStrategy implements SyncStrategy {
  readonly providerId: VacancySource = 'remotive';

  shouldSync(state: ProviderState): boolean {
    if (state.health === 'unhealthy') return false;
    if (state.consecutiveFailures >= 3) return false;
    if (!state.nextSync) return true;
    return Date.now() >= state.nextSync.getTime();
  }

  getFullSyncCursor(): SyncCursor {
    return { type: 'none', message: 'Remotive returns all jobs at once' };
  }

  getIncrementalCursor(state: ProviderState): SyncCursor {
    return { type: 'timestamp', since: state.lastSync ?? new Date(0), inclusive: false, maxRangeMs: 24 * 60 * 60 * 1000 };
  }

  processResults(state: ProviderState, results: NormalizedVacancy[], _cursor: CursorState): SyncStrategyResult {
    const imported = results.length;
    const stateUpdates: ProviderStateUpdate = {
      providerId: this.providerId,
      changes: {
        lastSync: new Date(),
        importedCount: state.importedCount + imported,
        failedCount: state.failedCount,
        consecutiveFailures: 0,
        consecutiveSuccesses: state.consecutiveSuccesses + 1,
      },
    };
    return { stateUpdates, shouldContinue: false, metrics: { fetched: results.length, normalized: imported, deduplicated: 0, imported, failed: 0, durationMs: 0 } };
  }
}

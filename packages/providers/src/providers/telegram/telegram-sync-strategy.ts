import type { SyncStrategy, SyncStrategyResult } from '../../interfaces/sync-strategy.js';
import type { VacancySource } from '../../types/provider.js';
import type { ProviderState } from '../../interfaces/provider-state.js';
import type { SyncCursor, CursorState } from '../../interfaces/sync-cursor.js';
import type { NormalizedVacancy } from '../../interfaces/normalized-vacancy.js';

/**
 * The `/s/` channel preview only ever returns the current ~20-message window
 * per channel (see telegram-fetcher.ts) — there's no real pagination to walk
 * backward through, so unlike HH/Habr this strategy leans on a short sync
 * interval instead of a deep cursor to avoid missing fast-moving channels'
 * posts between syncs.
 */
export class TelegramSyncStrategy implements SyncStrategy {
  readonly providerId: VacancySource = 'telegram';

  shouldSync(state: ProviderState): boolean {
    if (state.health === 'unhealthy') return false;
    if (state.consecutiveFailures >= 3) return false;
    if (!state.nextSync) return true;
    return Date.now() >= state.nextSync.getTime();
  }

  getFullSyncCursor(): SyncCursor {
    return { type: 'none', message: 'Preview page has no full-history pagination' };
  }

  getIncrementalCursor(state: ProviderState): SyncCursor {
    const since = state.lastSync ?? new Date(0);
    return {
      type: 'timestamp',
      since,
      inclusive: false,
      maxRangeMs: 30 * 60 * 1000, // 30 minutes
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
      shouldContinue: false,
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

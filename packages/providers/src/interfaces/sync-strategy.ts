import type { ProviderState, ProviderStateUpdate } from './provider-state.js';
import type { SyncCursor, CursorState } from './sync-cursor.js';
import type { NormalizedVacancy } from './normalized-vacancy.js';

export interface SyncStrategy {
  readonly providerId: string;
  shouldSync(state: ProviderState): boolean;
  getFullSyncCursor(): SyncCursor;
  getIncrementalCursor(state: ProviderState): SyncCursor;
  processResults(
    state: ProviderState,
    results: NormalizedVacancy[],
    cursor: CursorState,
  ): SyncStrategyResult;
}

export interface SyncStrategyResult {
  readonly stateUpdates: ProviderStateUpdate;
  readonly shouldContinue: boolean;
  readonly nextCursor?: SyncCursor;
  readonly metrics: SyncMetrics;
}

export interface SyncMetrics {
  readonly fetched: number;
  readonly normalized: number;
  readonly deduplicated: number;
  readonly imported: number;
  readonly failed: number;
  readonly durationMs: number;
}

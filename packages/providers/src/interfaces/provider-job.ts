import type { ProviderInfo } from './provider-info.js';
import type { ProviderCapabilities } from './provider-capabilities.js';
import type { ProviderState, ProviderStateUpdate } from './provider-state.js';
import type { ProviderResult } from './result.js';
import type { NormalizedVacancy } from './normalized-vacancy.js';
import type { SearchCriteria } from './search-criteria.js';
import type { CursorState } from './sync-cursor.js';
import type { Fetcher } from './fetcher.js';
import type { Mapper } from './mapper.js';
import type { Normalizer, NormalizationResult } from './normalizer.js';
import type { SyncStrategy, SyncStrategyResult } from './sync-strategy.js';

export interface ProviderJob {
  readonly info: ProviderInfo;
  readonly capabilities: ProviderCapabilities;
  readonly state: ProviderState;
  readonly fetcher: Fetcher;
  readonly mapper: Mapper;
  readonly normalizer: Normalizer;
  readonly syncStrategy: SyncStrategy;

  initialize(config: ProviderConfig): Promise<void>;
  search(criteria: SearchCriteria): Promise<ProviderResult<SearchResult>>;
  getVacancy(sourceId: string): Promise<ProviderResult<NormalizedVacancy | null>>;
  sync(): Promise<ProviderResult<SyncResult>>;
  healthCheck(): Promise<ProviderHealthCheckResult>;
  dispose(): Promise<void>;
}

export interface ProviderConfig {
  readonly credentials?: Record<string, string>;
  readonly settings?: Record<string, unknown>;
  readonly capabilityOverrides?: Partial<ProviderCapabilities>;
}

export interface SearchResult {
  readonly vacancies: readonly NormalizedVacancy[];
  readonly cursor: CursorState;
  readonly totalResults?: number;
  readonly normalization: NormalizationResult;
}

export interface SyncResult {
  readonly imported: readonly NormalizedVacancy[];
  readonly stateUpdates: ProviderStateUpdate;
  readonly metrics: SyncStrategyResult['metrics'];
  readonly shouldContinue: boolean;
  readonly nextCursor?: CursorState;
}

export interface ProviderHealthCheckResult {
  readonly healthy: boolean;
  readonly latencyMs: number;
  readonly message?: string;
}

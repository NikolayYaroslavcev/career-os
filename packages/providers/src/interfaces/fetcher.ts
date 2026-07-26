import type { ProviderResult } from './result.js';
import type { RawJob } from './raw-job.js';
import type { SearchCriteria } from './search-criteria.js';
import type { SyncCursor, CursorState } from './sync-cursor.js';

export interface Fetcher {
  search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>>;
  getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>>;
  fetchWithCursor(
    criteria: SearchCriteria,
    cursor: SyncCursor,
  ): Promise<ProviderResult<FetchResult>>;
  ping(): Promise<ProviderResult<boolean>>;
}

export interface FetchResult {
  readonly jobs: readonly RawJob[];
  readonly cursor: CursorState;
  readonly hasMore: boolean;
  readonly meta: Record<string, unknown>;
}

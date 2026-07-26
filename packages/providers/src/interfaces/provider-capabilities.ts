import type { ExperienceLevel } from '../types/vacancy.js';
import type { PaginationStrategy } from '../types/provider.js';

export interface ProviderCapabilities {
  readonly search: SearchCapabilities;
  readonly pagination: PaginationCapabilities;
  readonly sync: SyncCapabilities;
  readonly filtering: FilteringCapabilities;
  readonly rateLimits: RateLimitCapabilities;
  readonly characteristics: ResponseCharacteristics;
}

export interface SearchCapabilities {
  readonly supported: boolean;
  readonly maxResults: number;
  readonly supportsKeyword: boolean;
  readonly supportsLocation: boolean;
  readonly supportsTechnology: boolean;
}

export interface PaginationCapabilities {
  readonly strategy: PaginationStrategy;
  readonly maxPageSize: number;
  readonly defaultPageSize: number;
  readonly maxTotalResults?: number;
}

export interface SyncCapabilities {
  readonly incremental: boolean;
  readonly fullSync: boolean;
  readonly maxSyncWindowMs?: number;
  readonly minSyncIntervalMs: number;
}

export interface FilteringCapabilities {
  readonly experienceLevels: readonly ExperienceLevel[];
  readonly salaryFilter: boolean;
  readonly remoteFilter: boolean;
  readonly technologyFilter: boolean;
  readonly dateFilter: boolean;
}

export interface RateLimitCapabilities {
  readonly perMinute: number;
  readonly perDay?: number;
  readonly providesHeaders: boolean;
  readonly providesInfo: boolean;
}

export interface ResponseCharacteristics {
  readonly avgResponseTimeMs: number;
  readonly fullDescription: boolean;
  readonly salaryData: boolean;
  readonly companyDetails: boolean;
}

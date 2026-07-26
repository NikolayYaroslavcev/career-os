# ADR-022: Provider SDK Architecture

## Status

Draft

## Date

2026-07-15

## Context

CareerOS integrates with multiple external job sources (HH, LinkedIn, Habr Career, RemoteOK, etc.). Each provider has different APIs, data formats, rate limits, and reliability characteristics. We need a comprehensive provider SDK that:

- Abstracts provider differences behind unified interfaces
- Handles provider lifecycle (registration, health, degradation)
- Manages rate limiting and retries per-provider
- Normalizes heterogeneous data into domain entities
- Deduplicates vacancies across providers
- Supports incremental sync and pagination
- Provides observability (metrics, logging, health status)

## Decision

We will create a Provider SDK in `packages/providers/` with the following architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Layer                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  JobAggregator   │  │  SyncScheduler   │  │  SearchOrchest.   │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────────┘  │
│           │                     │                     │              │
├───────────┼─────────────────────┼─────────────────────┼──────────────┤
│           v                     v                     v              │
│                      Provider SDK Layer                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    ProviderRegistry                           │   │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐     │   │
│  │  │  HH     │  │ LinkedIn │  │  Habr   │  │ RemoteOK │ ...  │   │
│  │  │Provider │  │ Provider │  │Provider │  │ Provider │     │   │
│  │  └────┬────┘  └────┬─────┘  └────┬────┘  └────┬─────┘     │   │
│  │       │             │            │             │             │   │
│  │       v             v            v             v             │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │              ProviderJob (per-provider)                │  │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐  │  │   │
│  │  │  │ Fetcher │  │ Mapper  │  │  Normalizer          │  │  │   │
│  │  │  └────┬────┘  └────┬────┘  └──────────┬──────────┘  │  │   │
│  │  │       │             │                  │              │  │   │
│  │  └───────┼─────────────┼──────────────────┼──────────────┘  │   │
│  │          v             v                  v                  │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │         NormalizedVacancy (single domain model)       │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  │          │                                                   │   │
│  │          v                                                   │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │             DeduplicationEngine                        │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           v                                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │               Infrastructure Layer                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │
│  │  │ RateLimiter│ │RetryPolicy│ │HealthMon │  │ Metrics  │   │   │
│  │  │(per-prov) │  │(per-prov) │ │(per-prov)│  │(per-prov)│   │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 1. Core Interfaces

### 1.1 NormalizedVacancy (Single Domain Model)

All providers map into this single model. Provider-specific models must never leave the provider layer.

```typescript
// packages/providers/src/domain/normalized-vacancy.ts

import type { VacancySource } from '@career-os/career-domain';

export interface NormalizedVacancy {
  /** Internal ID (source + sourceId) */
  readonly id: string;

  /** Source provider identifier */
  readonly source: VacancySource;

  /** Provider-specific external ID */
  readonly sourceId: string;

  /** Job title (cleaned, normalized) */
  readonly title: string;

  /** Job description (HTML stripped, normalized) */
  readonly description: string;

  /** Company name */
  readonly companyName: string;

  /** Company external ID if available */
  readonly companySourceId?: string;

  /** Normalized location */
  readonly location: LocationInfo;

  /** Salary range (normalized to USD monthly) */
  readonly salary?: SalaryInfo;

  /** Experience level enum */
  readonly experienceLevel?: ExperienceLevel;

  /** Normalized technologies list */
  readonly technologies: readonly string[];

  /** Direct link to job posting */
  readonly url: string;

  /** Publication date */
  readonly publishedAt: Date;

  /** When this was fetched */
  readonly fetchedAt: Date;

  /** Remote work support */
  readonly remote: RemoteInfo;

  /** Employment type */
  readonly employmentType?: EmploymentType;

  /** When this vacancy was normalized */
  readonly normalizedAt: Date;

  /** Hash for deduplication */
  readonly contentHash: string;
}

export interface LocationInfo {
  /** Raw location string from provider */
  readonly raw: string;

  /** Normalized city */
  readonly city?: string;

  /** Normalized country (ISO 3166-1 alpha-2) */
  readonly country?: string;

  /** Whether location is remote-eligible */
  readonly remoteEligible: boolean;
}

export interface SalaryInfo {
  /** Minimum salary (normalized to USD monthly) */
  readonly min?: number;

  /** Maximum salary (normalized to USD monthly) */
  readonly max?: number;

  /** Original currency before conversion */
  readonly originalCurrency?: string;

  /** Original amount range before conversion */
  readonly originalMin?: number;

  /** Original amount range before conversion */
  readonly originalMax?: number;

  /** Salary period (always normalized to monthly) */
  readonly period: 'monthly';

  /** Whether salary data is from provider or inferred */
  readonly isEstimate: boolean;
}

export type ExperienceLevel =
  | 'intern'
  | 'junior'
  | 'middle'
  | 'senior'
  | 'lead'
  | 'principal';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'freelance'
  | 'internship';

export interface RemoteInfo {
  /** Remote support level */
  readonly level: RemoteLevel;

  /** Whether explicitly marked as remote in source */
  readonly explicit: boolean;
}

export type RemoteLevel =
  | 'remote_only'
  | 'hybrid'
  | 'onsite'
  | 'unknown';
```

### 1.2 ProviderInfo

Static metadata about a provider. Immutable after registration.

```typescript
// packages/providers/src/domain/provider-info.ts

import type { VacancySource } from '@career-os/career-domain';

export interface ProviderInfo {
  /** Unique provider identifier */
  readonly id: VacancySource;

  /** Human-readable provider name */
  readonly name: string;

  /** Provider version (semver) */
  readonly version: string;

  /** ISO 3166-1 alpha-2 country codes where provider operates */
  readonly supportedCountries: readonly string[];

  /** ISO 639-1 language codes supported by provider */
  readonly supportedLanguages: readonly string[];

  /** Authentication requirements */
  readonly auth: AuthRequirements;

  /** Whether provider supports remote job listings */
  readonly supportsRemote: boolean;

  /** Base URL for provider API */
  readonly baseUrl: string;

  /** Documentation URL */
  readonly docsUrl?: string;
}

export interface AuthRequirements {
  /** Authentication type required */
  readonly type: AuthType;

  /** Whether API key is required */
  readonly requiresApiKey: boolean;

  /** Whether OAuth flow is required */
  readonly requiresOAuth: boolean;

  /** Whether authentication is optional (can work without) */
  readonly optional: boolean;

  /** Scopes required for OAuth (if applicable) */
  readonly scopes?: readonly string[];
}

export type AuthType =
  | 'none'
  | 'api_key'
  | 'oauth2'
  | 'basic'
  | 'custom';
```

### 1.3 ProviderCapabilities (Structured)

Structured capability objects replace simple booleans. Each capability is a rich object describing what a provider can do and how.

```typescript
// packages/providers/src/domain/provider-capabilities.ts

import type { ExperienceLevel } from './normalized-vacancy.js';

export interface ProviderCapabilities {
  /** Search capabilities */
  readonly search: SearchCapabilities;

  /** Pagination capabilities */
  readonly pagination: PaginationCapabilities;

  /** Sync capabilities */
  readonly sync: SyncCapabilities;

  /** Filtering capabilities */
  readonly filtering: FilteringCapabilities;

  /** Rate limits */
  readonly rateLimits: RateLimitCapabilities;

  /** Response characteristics */
  readonly characteristics: ResponseCharacteristics;
}

export interface SearchCapabilities {
  /** Can search for jobs by criteria */
  readonly supported: boolean;

  /** Maximum results per search */
  readonly maxResults: number;

  /** Supports keyword search */
  readonly supportsKeyword: boolean;

  /** Supports location search */
  readonly supportsLocation: boolean;

  /** Supports technology/skill search */
  readonly supportsTechnology: boolean;
}

export interface PaginationCapabilities {
  /** Pagination strategy used by provider */
  readonly strategy: PaginationStrategy;

  /** Maximum items per page */
  readonly maxPageSize: number;

  /** Default page size */
  readonly defaultPageSize: number;

  /** Maximum total results accessible */
  readonly maxTotalResults?: number;
}

export type PaginationStrategy =
  | 'cursor'
  | 'page'
  | 'offset'
  | 'timestamp'
  | 'none';

export interface SyncCapabilities {
  /** Supports incremental sync (since timestamp) */
  readonly incremental: boolean;

  /** Supports full sync */
  readonly fullSync: boolean;

  /** Maximum time range for incremental sync (ms) */
  readonly maxSyncWindowMs?: number;

  /** Minimum interval between syncs (ms) */
  readonly minSyncIntervalMs: number;
}

export interface FilteringCapabilities {
  /** Supported experience level filters */
  readonly experienceLevels: readonly ExperienceLevel[];

  /** Supports salary range filtering */
  readonly salaryFilter: boolean;

  /** Supports remote-only filtering */
  readonly remoteFilter: boolean;

  /** Supports technology filtering */
  readonly technologyFilter: boolean;

  /** Supports date range filtering */
  readonly dateFilter: boolean;
}

export interface RateLimitCapabilities {
  /** Maximum requests per minute */
  readonly perMinute: number;

  /** Maximum requests per day (if applicable) */
  readonly perDay?: number;

  /** Whether rate limit headers are provided */
  readonly providesHeaders: boolean;

  /** Whether rate limit info is in response */
  readonly providesInfo: boolean;
}

export interface ResponseCharacteristics {
  /** Average response time in ms */
  readonly avgResponseTimeMs: number;

  /** Whether responses include full description */
  readonly fullDescription: boolean;

  /** Whether responses include salary info */
  readonly salaryData: boolean;

  /** Whether responses include company details */
  readonly companyDetails: boolean;
}
```

### 1.4 SyncCursor (Pagination Abstraction)

Unified cursor abstraction supporting multiple pagination strategies.

```typescript
// packages/providers/src/domain/sync-cursor.ts

import type { PaginationStrategy } from './provider-capabilities.js';

export type SyncCursor =
  | CursorCursor
  | PageCursor
  | OffsetCursor
  | TimestampCursor
  | NoCursor;

export interface CursorCursor {
  readonly type: 'cursor';

  /** Opaque cursor value from provider */
  readonly value: string;

  /** Whether there are more results */
  readonly hasMore: boolean;

  /** Total results so far (if available) */
  readonly totalResults?: number;
}

export interface PageCursor {
  readonly type: 'page';

  /** Current page number (1-based) */
  readonly page: number;

  /** Items per page */
  readonly perPage: number;

  /** Total pages (if available) */
  readonly totalPages?: number;

  /** Total results (if available) */
  readonly totalResults?: number;
}

export interface OffsetCursor {
  readonly type: 'offset';

  /** Current offset from start */
  readonly offset: number;

  /** Number of items to fetch */
  readonly limit: number;

  /** Total results (if available) */
  readonly totalResults?: number;
}

export interface TimestampCursor {
  readonly type: 'timestamp';

  /** Fetch items published after this timestamp */
  readonly since: Date;

  /** Whether to include items with exact timestamp match */
  readonly inclusive: boolean;

  /** Maximum time range per request */
  readonly maxRangeMs?: number;
}

export interface NoCursor {
  readonly type: 'none';

  /** Provider does not support pagination */
  readonly message: string;
}

export interface CursorState {
  /** Current cursor position */
  readonly cursor: SyncCursor;

  /** Strategy used by this provider */
  readonly strategy: PaginationStrategy;

  /** Whether pagination is exhausted */
  readonly exhausted: boolean;

  /** Number of items fetched so far */
  readonly fetchedCount: number;
}

/**
 * Create initial cursor state for a provider's pagination strategy.
 */
export function createInitialCursor(
  strategy: PaginationStrategy,
  options?: {
    pageSize?: number;
    since?: Date;
  },
): CursorState {
  switch (strategy) {
    case 'cursor':
      return {
        cursor: { type: 'cursor', value: '', hasMore: true },
        strategy,
        exhausted: false,
        fetchedCount: 0,
      };
    case 'page':
      return {
        cursor: {
          type: 'page',
          page: 1,
          perPage: options?.pageSize ?? 20,
          hasMore: true,
        },
        strategy,
        exhausted: false,
        fetchedCount: 0,
      };
    case 'offset':
      return {
        cursor: {
          type: 'offset',
          offset: 0,
          limit: options?.pageSize ?? 20,
        },
        strategy,
        exhausted: false,
        fetchedCount: 0,
      };
    case 'timestamp':
      return {
        cursor: {
          type: 'timestamp',
          since: options?.since ?? new Date(0),
          inclusive: false,
        },
        strategy,
        exhausted: false,
        fetchedCount: 0,
      };
    case 'none':
      return {
        cursor: { type: 'none', message: 'Provider does not support pagination' },
        strategy,
        exhausted: true,
        fetchedCount: 0,
      };
  }
}

/**
 * Advance cursor to next page/batch.
 */
export function advanceCursor(
  current: CursorState,
  result: { count: number; hasMore: boolean; nextValue?: string },
): CursorState {
  const newFetched = current.fetchedCount + result.count;

  if (!result.hasMore) {
    return {
      ...current,
      exhausted: true,
      fetchedCount: newFetched,
    };
  }

  let nextCursor: SyncCursor;

  switch (current.cursor.type) {
    case 'cursor':
      nextCursor = {
        type: 'cursor',
        value: result.nextValue ?? '',
        hasMore: result.hasMore,
      };
      break;
    case 'page':
      nextCursor = {
        type: 'page',
        page: current.cursor.page + 1,
        perPage: current.cursor.perPage,
        totalPages: current.cursor.totalPages,
        totalResults: current.cursor.totalResults,
      };
      break;
    case 'offset':
      nextCursor = {
        type: 'offset',
        offset: current.cursor.offset + current.cursor.limit,
        limit: current.cursor.limit,
        totalResults: current.cursor.totalResults,
      };
      break;
    case 'timestamp':
      nextCursor = {
        type: 'timestamp',
        since: new Date(),
        inclusive: false,
        maxRangeMs: current.cursor.maxRangeMs,
      };
      break;
    case 'none':
      nextCursor = current.cursor;
      break;
  }

  return {
    cursor: nextCursor,
    strategy: current.strategy,
    exhausted: false,
    fetchedCount: newFetched,
  };
}
```

### 1.5 ProviderState

Tracks provider operational state including sync history and health.

```typescript
// packages/providers/src/domain/provider-state.ts

import type { VacancySource } from '@career-os/career-domain';
import type { HealthState } from '../health/provider-health-monitor.js';

export interface ProviderState {
  /** Provider identifier */
  readonly providerId: VacancySource;

  /** Last successful sync timestamp */
  readonly lastSync: Date | null;

  /** Scheduled next sync timestamp */
  readonly nextSync: Date | null;

  /** Current health state */
  readonly health: HealthState;

  /** Total vacancies imported (lifetime) */
  readonly importedCount: number;

  /** Total vacancies failed to import (lifetime) */
  readonly failedCount: number;

  /** Total vacancies normalized (lifetime) */
  readonly normalizedCount: number;

  /** Total vacancies deduplicated (lifetime) */
  readonly deduplicatedCount: number;

  /** Last error message (if any) */
  readonly lastError: string | null;

  /** Last error timestamp */
  readonly lastErrorAt: Date | null;

  /** Number of consecutive failures */
  readonly consecutiveFailures: number;

  /** Number of consecutive successes */
  readonly consecutiveSuccesses: number;

  /** Average response time over last 100 requests */
  readonly avgResponseTimeMs: number;

  /** Total requests made (lifetime) */
  readonly totalRequests: number;

  /** When this state was last updated */
  readonly updatedAt: Date;
}

export interface ProviderStateUpdate {
  /** Provider identifier */
  readonly providerId: VacancySource;

  /** Fields to update */
  readonly changes: Partial<Omit<ProviderState, 'providerId' | 'updatedAt'>>;
}

export function createInitialState(providerId: VacancySource): ProviderState {
  return {
    providerId,
    lastSync: null,
    nextSync: null,
    health: 'unknown',
    importedCount: 0,
    failedCount: 0,
    normalizedCount: 0,
    deduplicatedCount: 0,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    avgResponseTimeMs: 0,
    totalRequests: 0,
    updatedAt: new Date(),
  };
}
```

### 1.6 ProviderResult Type

Every provider method returns a `ProviderResult` that separates success from provider-specific errors.

```typescript
// packages/providers/src/domain/provider-result.ts

export type ProviderResult<T> =
  | ProviderSuccess<T>
  | ProviderError;

export interface ProviderSuccess<T> {
  readonly ok: true;
  readonly data: T;
  readonly meta: ResultMeta;
}

export interface ProviderError {
  readonly ok: false;
  readonly error: ProviderErrorType;
  readonly message: string;
  readonly retryable: boolean;
  readonly meta: ResultMeta;
}

export interface ResultMeta {
  /** Response time in milliseconds */
  readonly durationMs: number;

  /** Provider-specific metadata */
  readonly providerMeta?: Record<string, unknown>;

  /** Rate limit info if available */
  readonly rateLimit?: RateLimitInfo;

  /** Cursor state after this operation */
  readonly cursor?: import('./sync-cursor.js').CursorState;
}

export interface RateLimitInfo {
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: Date;
}

export enum ProviderErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

### 1.7 Search Criteria

Normalized search parameters passed to providers.

```typescript
// packages/providers/src/domain/search-criteria.ts

import type { ExperienceLevel } from './normalized-vacancy.js';
import type { SyncCursor } from './sync-cursor.js';

export interface SearchCriteria {
  /** Search query (keywords) */
  readonly query?: string;

  /** Desired positions */
  readonly positions?: readonly string[];

  /** Required/desired technologies */
  readonly technologies?: readonly string[];

  /** Location filter */
  readonly location?: string;

  /** Remote-only flag */
  readonly remoteOnly?: boolean;

  /** Experience level range */
  readonly experienceLevel?: {
    readonly min?: ExperienceLevel;
    readonly max?: ExperienceLevel;
  };

  /** Salary range (in USD monthly) */
  readonly salary?: {
    readonly min?: number;
    readonly max?: number;
  };

  /** Pagination cursor */
  readonly cursor?: SyncCursor;

  /** Maximum results to return */
  readonly limit?: number;

  /** Sort order */
  readonly sort?: {
    readonly field: 'date' | 'relevance' | 'salary';
    readonly order: 'asc' | 'desc';
  };

  /** Only jobs published after this date */
  readonly publishedAfter?: Date;

  /** Provider-specific filters (provider must validate) */
  readonly filters?: Record<string, unknown>;
}
```

### 1.8 Raw Job (Provider-Specific Format)

Each provider returns jobs in its own format. This is the raw, unnormalized shape. This interface is NOT exported from the SDK.

```typescript
// packages/providers/src/domain/raw-job.ts (INTERNAL)

export interface RawJob {
  /** Provider-specific external ID */
  readonly sourceId: string;

  /** Job title as returned by provider */
  readonly title: string;

  /** Job description (may be HTML) */
  readonly description: string;

  /** Company name as returned by provider */
  readonly companyName: string;

  /** Company external ID if available */
  readonly companySourceId?: string;

  /** Location string as returned by provider */
  readonly location: string;

  /** Salary range if available (provider format) */
  readonly salary?: RawSalary;

  /** Experience level as interpreted by provider */
  readonly experienceLevel?: string;

  /** Technologies/skills mentioned */
  readonly technologies: readonly string[];

  /** Direct link to job posting */
  readonly url: string;

  /** Publication date */
  readonly publishedAt: Date;

  /** Remote work flag */
  readonly remote?: boolean;

  /** Employment type as returned by provider */
  readonly employmentType?: string;

  /** When this was fetched */
  readonly fetchedAt: Date;

  /** Provider-specific extra fields */
  readonly extensions?: Record<string, unknown>;
}

export interface RawSalary {
  readonly from?: number;
  readonly to?: number;
  readonly currency: string;
  readonly period: 'hourly' | 'monthly' | 'yearly' | 'unknown';
}
```

## 2. Provider Component Interfaces

### 2.1 Fetcher

Handles raw data retrieval from provider APIs. Returns provider-specific formats.

```typescript
// packages/providers/src/components/fetcher.ts

import type { ProviderResult } from '../domain/provider-result.js';
import type { RawJob } from '../domain/raw-job.js';
import type { SearchCriteria } from '../domain/search-criteria.js';
import type { SyncCursor, CursorState } from '../domain/sync-cursor.js';

export interface Fetcher {
  /**
   * Search for raw jobs matching criteria.
   */
  search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>>;

  /**
   * Fetch detailed information for a specific vacancy.
   */
  getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>>;

  /**
   * Fetch jobs using cursor-based pagination.
   */
  fetchWithCursor(
    criteria: SearchCriteria,
    cursor: SyncCursor,
  ): Promise<ProviderResult<FetchResult>>;

  /**
   * Check if provider is reachable.
   */
  ping(): Promise<ProviderResult<boolean>>;
}

export interface FetchResult {
  /** Raw jobs fetched in this batch */
  readonly jobs: readonly RawJob[];

  /** Updated cursor state */
  readonly cursor: CursorState;

  /** Whether more results are available */
  readonly hasMore: boolean;

  /** Provider-specific response metadata */
  readonly meta: Record<string, unknown>;
}
```

### 2.2 Mapper

Transforms provider-specific RawJob into domain-ready intermediate format.

```typescript
// packages/providers/src/components/mapper.ts

import type { RawJob } from '../domain/raw-job.js';
import type { NormalizedVacancy } from '../domain/normalized-vacancy.js';

export interface Mapper {
  /**
   * Provider identifier this mapper is for.
   */
  readonly providerId: string;

  /**
   * Transform raw job to intermediate format.
   * Does NOT produce final NormalizedVacancy; that's the Normalizer's job.
   */
  map(raw: RawJob): MappedJob;
}

export interface MappedJob {
  /** Provider-specific external ID */
  readonly sourceId: string;

  /** Cleaned title */
  readonly title: string;

  /** Cleaned description (HTML stripped) */
  readonly description: string;

  /** Company name */
  readonly companyName: string;

  /** Company source ID if available */
  readonly companySourceId?: string;

  /** Parsed location */
  readonly location: {
    readonly raw: string;
    readonly city?: string;
    readonly country?: string;
  };

  /** Parsed salary (original currency) */
  readonly salary?: {
    readonly min?: number;
    readonly max?: number;
    readonly currency: string;
    readonly period: 'hourly' | 'monthly' | 'yearly' | 'unknown';
  };

  /** Inferred experience level */
  readonly experienceLevel?: string;

  /** Extracted technologies */
  readonly technologies: readonly string[];

  /** Job URL */
  readonly url: string;

  /** Publication date */
  readonly publishedAt: Date;

  /** Remote flag */
  readonly remote?: boolean;

  /** Employment type */
  readonly employmentType?: string;

  /** Extensions from provider */
  readonly extensions?: Record<string, unknown>;
}
```

### 2.3 Normalizer

Converts MappedJob into the single NormalizedVacancy domain model.

```typescript
// packages/providers/src/components/normalizer.ts

import type { MappedJob } from './mapper.js';
import type { NormalizedVacancy } from '../domain/normalized-vacancy.js';
import type { VacancySource } from '@career-os/career-domain';

export interface Normalizer {
  /**
   * Provider identifier this normalizer is for.
   */
  readonly providerId: VacancySource;

  /**
   * Normalize a mapped job into the domain model.
   */
  normalize(job: MappedJob): NormalizedVacancy;

  /**
   * Validate a mapped job before normalization.
   * Returns null if valid, error message if not.
   */
  validate(job: MappedJob): NormalizationError | null;
}

export interface NormalizationError {
  readonly field: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface NormalizationResult {
  readonly succeeded: NormalizedVacancy[];
  readonly failed: NormalizationFailure[];
  readonly stats: NormalizationStats;
}

export interface NormalizationFailure {
  readonly sourceId: string;
  readonly reason: string;
  readonly field?: string;
}

export interface NormalizationStats {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly durationMs: number;
}
```

### 2.4 SyncStrategy

Defines how synchronization is performed for a provider.

```typescript
// packages/providers/src/components/sync-strategy.ts

import type { VacancySource } from '@career-os/career-domain';
import type { ProviderState, ProviderStateUpdate } from '../domain/provider-state.js';
import type { SyncCursor, CursorState } from '../domain/sync-cursor.js';
import type { NormalizedVacancy } from '../domain/normalized-vacancy.js';

export interface SyncStrategy {
  /**
   * Provider identifier.
   */
  readonly providerId: VacancySource;

  /**
   * Determine if sync should run now.
   */
  shouldSync(state: ProviderState): boolean;

  /**
   * Get initial cursor for a full sync.
   */
  getFullSyncCursor(): SyncCursor;

  /**
   * Get initial cursor for an incremental sync.
   */
  getIncrementalCursor(state: ProviderState): SyncCursor;

  /**
   * Process sync results and return state updates.
   */
  processResults(
    state: ProviderState,
    results: NormalizedVacancy[],
    cursor: CursorState,
  ): SyncStrategyResult;
}

export interface SyncStrategyResult {
  /** State updates to apply */
  readonly stateUpdates: ProviderStateUpdate;

  /** Whether to continue fetching (has more pages) */
  readonly shouldContinue: boolean;

  /** Next cursor to use (if continuing) */
  readonly nextCursor?: SyncCursor;

  /** Metrics for this sync batch */
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

/**
 * Default sync strategy with timestamp-based incremental sync.
 */
export class DefaultSyncStrategy implements SyncStrategy {
  constructor(
    readonly providerId: VacancySource,
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
```

## 3. ProviderJob (Orchestrator)

Orchestrates Fetcher, Mapper, Normalizer, and SyncStrategy. Does NOT perform their responsibilities.

```typescript
// packages/providers/src/domain/provider-job.ts

import type { VacancySource } from '@career-os/career-domain';
import type { ProviderInfo } from './provider-info.js';
import type { ProviderCapabilities } from './provider-capabilities.js';
import type { ProviderState, ProviderStateUpdate } from './provider-state.js';
import type { ProviderResult } from './provider-result.js';
import type { NormalizedVacancy } from './normalized-vacancy.js';
import type { SearchCriteria } from './search-criteria.js';
import type { CursorState } from './sync-cursor.js';
import type { Fetcher } from '../components/fetcher.js';
import type { Mapper } from '../components/mapper.js';
import type { Normalizer, NormalizationResult } from '../components/normalizer.js';
import type { SyncStrategy, SyncStrategyResult } from '../components/sync-strategy.js';

/**
 * ProviderJob orchestrates the provider components.
 * It does NOT fetch, map, normalize, or sync directly.
 * It coordinates the workflow between components.
 */
export interface ProviderJob {
  /** Static provider information */
  readonly info: ProviderInfo;

  /** Declared capabilities */
  readonly capabilities: ProviderCapabilities;

  /** Current operational state */
  readonly state: ProviderState;

  /** Component accessors */
  readonly fetcher: Fetcher;
  readonly mapper: Mapper;
  readonly normalizer: Normalizer;
  readonly syncStrategy: SyncStrategy;

  /**
   * Initialize provider with configuration.
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Search for vacancies (fetch + map + normalize).
   */
  search(criteria: SearchCriteria): Promise<ProviderResult<SearchResult>>;

  /**
   * Get a single vacancy by source ID.
   */
  getVacancy(sourceId: string): Promise<ProviderResult<NormalizedVacancy | null>>;

  /**
   * Perform incremental sync using the sync strategy.
   */
  sync(): Promise<ProviderResult<SyncResult>>;

  /**
   * Check provider health and connectivity.
   */
  healthCheck(): Promise<ProviderHealthCheckResult>;

  /**
   * Dispose provider resources.
   */
  dispose(): Promise<void>;
}

export interface ProviderConfig {
  /** API credentials */
  readonly credentials?: Record<string, string>;

  /** Provider-specific settings */
  readonly settings?: Record<string, unknown>;

  /** Override default capabilities */
  readonly capabilityOverrides?: Partial<ProviderCapabilities>;
}

export interface SearchResult {
  /** Normalized vacancies */
  readonly vacancies: readonly NormalizedVacancy[];

  /** Updated cursor state */
  readonly cursor: CursorState;

  /** Total results available (if known) */
  readonly totalResults?: number;

  /** Normalization statistics */
  readonly normalization: NormalizationResult;
}

export interface SyncResult {
  /** Vacancies imported in this sync */
  readonly imported: readonly NormalizedVacancy[];

  /** State updates from this sync */
  readonly stateUpdates: ProviderStateUpdate;

  /** Sync metrics */
  readonly metrics: SyncStrategyResult['metrics'];

  /** Whether sync should continue */
  readonly shouldContinue: boolean;

  /** Next cursor (if continuing) */
  readonly nextCursor?: CursorState;
}

export interface ProviderHealthCheckResult {
  readonly healthy: boolean;
  readonly latencyMs: number;
  readonly message?: string;
}
```

### Default ProviderJob Implementation

```typescript
// packages/providers/src/domain/default-provider-job.ts

import type { VacancySource } from '@career-os/career-domain';
import type { ProviderInfo } from './provider-info.js';
import type { ProviderCapabilities } from './provider-capabilities.js';
import type { ProviderState } from './provider-state.js';
import type { ProviderResult, ProviderSuccess } from './provider-result.js';
import type { NormalizedVacancy } from './normalized-vacancy.js';
import type { SearchCriteria } from './search-criteria.js';
import type { ProviderJob, ProviderConfig, SearchResult, SyncResult, ProviderHealthCheckResult } from './provider-job.js';
import type { Fetcher } from '../components/fetcher.js';
import type { Mapper } from '../components/mapper.js';
import type { Normalizer } from '../components/normalizer.js';
import type { SyncStrategy } from '../components/sync-strategy.js';
import { createInitialState } from './provider-state.js';
import { createInitialCursor, advanceCursor } from './sync-cursor.js';

export class DefaultProviderJob implements ProviderJob {
  readonly state: ProviderState;
  private _initialized = false;

  constructor(
    readonly info: ProviderInfo,
    readonly capabilities: ProviderCapabilities,
    readonly fetcher: Fetcher,
    readonly mapper: Mapper,
    readonly normalizer: Normalizer,
    readonly syncStrategy: SyncStrategy,
  ) {
    this.state = createInitialState(info.id);
  }

  async initialize(config: ProviderConfig): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<SearchResult>> {
    const cursor = criteria.cursor ?? createInitialCursor(
      this.capabilities.pagination.strategy,
      { pageSize: criteria.limit ?? this.capabilities.pagination.defaultPageSize },
    );

    // 1. Fetch raw jobs
    const fetchResult = await this.fetcher.fetchWithCursor(criteria, cursor);
    if (!fetchResult.ok) return fetchResult;

    // 2. Map raw jobs
    const mapped = fetchResult.data.jobs.map((raw) => this.mapper.map(raw));

    // 3. Normalize
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

    // 4. Advance cursor
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
          succeeded,
          failed: failed.map((f) => ({
            rawJob: null as never,
            reason: f.reason,
          })),
          stats: {
            total: mapped.length,
            succeeded: succeeded.length,
            failed: failed.length,
            durationMs: fetchResult.meta.durationMs,
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
        error: 'INVALID_RESPONSE',
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
    const searchResult = await this.search({ cursor, limit: this.capabilities.pagination.defaultPageSize });

    if (!searchResult.ok) {
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
      searchResult.data.vacancies,
      searchResult.data.cursor,
    );

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
```

## 4. Provider Registry

```typescript
// packages/providers/src/registry/provider-registry.ts

import type { VacancySource } from '@career-os/career-domain';
import type { ProviderJob } from '../domain/provider-job.js';
import type { ProviderState } from '../domain/provider-state.js';
import type { ProviderCapabilities } from '../domain/provider-capabilities.js';

export class ProviderRegistry {
  private providers = new Map<VacancySource, ProviderJob>();
  private states = new Map<VacancySource, ProviderState>();
  private initialized = new Set<VacancySource>();

  register(provider: ProviderJob): void {
    if (this.providers.has(provider.info.id)) {
      throw new Error(`Provider ${provider.info.id} already registered`);
    }
    this.providers.set(provider.info.id, provider);
    this.states.set(provider.info.id, provider.state);
  }

  get(id: VacancySource): ProviderJob {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new ProviderNotFoundError(id);
    }
    return provider;
  }

  getAll(): readonly ProviderJob[] {
    return Array.from(this.providers.values());
  }

  getState(id: VacancySource): ProviderState | undefined {
    return this.states.get(id);
  }

  getAllStates(): ProviderState[] {
    return Array.from(this.states.values());
  }

  getByCapability<K extends keyof ProviderCapabilities>(
    capability: K,
    value?: ProviderCapabilities[K],
  ): ProviderJob[] {
    return this.getAll().filter((p) => {
      if (value !== undefined) {
        return p.capabilities[capability] === value;
      }
      return Boolean(p.capabilities[capability]);
    });
  }

  async initializeAll(configs: Map<VacancySource, Record<string, string>>): Promise<void> {
    const initPromises = this.getAll()
      .filter((p) => !this.initialized.has(p.info.id))
      .map(async (provider) => {
        const credentials = configs.get(provider.info.id);
        await provider.initialize({ credentials });
        this.initialized.add(provider.info.id);
      });

    await Promise.allSettled(initPromises);
  }

  async disposeAll(): Promise<void> {
    const disposePromises = this.getAll()
      .filter((p) => this.initialized.has(p.info.id))
      .map(async (provider) => {
        await provider.dispose();
        this.initialized.delete(provider.info.id);
      });

    await Promise.allSettled(disposePromises);
  }

  isReady(id: VacancySource): boolean {
    return this.providers.has(id) && this.initialized.has(id);
  }
}

export class ProviderNotFoundError extends Error {
  constructor(providerId: string) {
    super(`Provider '${providerId}' not found in registry`);
    this.name = 'ProviderNotFoundError';
  }
}
```

## 5. Normalization Pipeline (Shared)

Shared normalization utilities used by all ProviderNormalizers.

```typescript
// packages/providers/src/normalization/normalization-pipeline.ts

import type { MappedJob } from '../components/mapper.js';
import type { NormalizedVacancy, ExperienceLevel, EmploymentType } from '../domain/normalized-vacancy.js';
import type { VacancySource } from '@career-os/career-domain';

export interface NormalizationPipeline {
  normalize(providerId: VacancySource, job: MappedJob): NormalizedVacancy;
}

export class DefaultNormalizationPipeline implements NormalizationPipeline {
  private readonly experienceLevels: Array<{ pattern: RegExp; level: ExperienceLevel }> = [
    { pattern: /\b(intern|стажёр|стажер)\b/i, level: 'intern' },
    { pattern: /\b(junior|младший)\b/i, level: 'junior' },
    { pattern: /\b(middle|средний)\b/i, level: 'middle' },
    { pattern: /\b(senior|старший)\b/i, level: 'senior' },
    { pattern: /\b(lead|руководитель)\b/i, level: 'lead' },
    { pattern: /\b(principal|главный)\b/i, level: 'principal' },
  ];

  private readonly employmentTypes: Array<{ pattern: RegExp; type: EmploymentType }> = [
    { pattern: /\b(full[\s-]?time|полная?\s*занятость)\b/i, type: 'full_time' },
    { pattern: /\b(part[\s-]?time|частичная\s*занятость)\b/i, type: 'part_time' },
    { pattern: /\b(contract|контракт)\b/i, type: 'contract' },
    { pattern: /\b(freelance|фриланс)\b/i, type: 'freelance' },
    { pattern: /\b(intern|стажировк)\b/i, type: 'internship' },
  ];

  normalize(providerId: VacancySource, job: MappedJob): NormalizedVacancy {
    const id = `${providerId}:${job.sourceId}`;
    const title = this.normalizeText(job.title);
    const description = this.normalizeText(job.description);
    const companyName = this.normalizeText(job.companyName);

    const experienceLevel = job.experienceLevel as ExperienceLevel | undefined
      ?? this.inferExperienceLevel(title, description);

    const employmentType = job.employmentType as EmploymentType | undefined
      ?? this.inferEmploymentType(title, description);

    const remote = this.normalizeRemote(job.remote);
    const location = this.normalizeLocation(job.location, remote);
    const salary = job.salary ? this.normalizeSalary(job.salary) : undefined;

    const technologies = [...new Set(
      job.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean),
    )];

    const contentHash = this.generateContentHash({
      title,
      companyName,
      location: location.raw,
      url: job.url,
    });

    return {
      id,
      source: providerId,
      sourceId: job.sourceId,
      title,
      description,
      companyName,
      companySourceId: job.companySourceId,
      location,
      salary,
      experienceLevel,
      technologies,
      url: job.url,
      publishedAt: job.publishedAt,
      fetchedAt: job.fetchedAt,
      remote,
      employmentType,
      normalizedAt: new Date(),
      contentHash,
    };
  }

  private normalizeText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private inferExperienceLevel(title: string, description: string): ExperienceLevel | undefined {
    const combined = `${title} ${description}`.toLowerCase();
    for (const { pattern, level } of this.experienceLevels) {
      if (pattern.test(combined)) return level;
    }
    return undefined;
  }

  private inferEmploymentType(title: string, description: string): EmploymentType | undefined {
    const combined = `${title} ${description}`.toLowerCase();
    for (const { pattern, type } of this.employmentTypes) {
      if (pattern.test(combined)) return type;
    }
    return undefined;
  }

  private normalizeRemote(remote?: boolean): NormalizedVacancy['remote'] {
    if (remote === true) {
      return { level: 'remote_only', explicit: true };
    }
    if (remote === false) {
      return { level: 'unknown', explicit: true };
    }
    return { level: 'unknown', explicit: false };
  }

  private normalizeLocation(
    location: MappedJob['location'],
    remote: NormalizedVacancy['remote'],
  ): NormalizedVacancy['location'] {
    return {
      raw: location.raw,
      city: location.city,
      country: location.country,
      remoteEligible: remote.level === 'remote_only' || remote.level === 'hybrid',
    };
  }

  private normalizeSalary(salary: MappedJob['salary']): NormalizedVacancy['salary'] {
    if (!salary) return undefined;

    // TODO: Implement currency conversion to USD
    // For now, assume USD
    return {
      min: salary.min,
      max: salary.max,
      originalCurrency: salary.currency !== 'USD' ? salary.currency : undefined,
      originalMin: salary.currency !== 'USD' ? salary.min : undefined,
      originalMax: salary.currency !== 'USD' ? salary.max : undefined,
      period: 'monthly',
      isEstimate: salary.period !== 'monthly',
    };
  }

  private generateContentHash(data: {
    title: string;
    companyName: string;
    location: string;
    url: string;
  }): string {
    // Simple hash for deduplication
    // In production, use a proper hash function
    const content = `${data.title}|${data.companyName}|${data.location}|${data.url}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
```

## 6. Infrastructure Components

### 6.1 Rate Limiter

Token bucket algorithm with per-provider limits.

```typescript
// packages/providers/src/infrastructure/rate-limiter.ts

export interface RateLimitConfig {
  readonly capacity: number;
  readonly refillRate: number;
  readonly refillIntervalMs: number;
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, TokenBucket>();

  constructor(private readonly config: RateLimitConfig) {}

  async acquire(key: string, tokens: number = 1): Promise<boolean> {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.config);
      this.buckets.set(key, bucket);
    }
    return bucket.consume(tokens);
  }

  getStatus(key: string): BucketStatus {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return {
        available: this.config.capacity,
        capacity: this.config.capacity,
        refillsAt: new Date(),
      };
    }
    return bucket.getStatus();
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly config: RateLimitConfig) {
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
  }

  consume(tokens: number): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  getStatus(): BucketStatus {
    this.refill();
    return {
      available: Math.floor(this.tokens),
      capacity: this.config.capacity,
      refillsAt: new Date(this.lastRefill + this.config.refillIntervalMs),
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.config.refillIntervalMs) * this.config.refillRate;
    this.tokens = Math.min(this.config.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

interface BucketStatus {
  readonly available: number;
  readonly capacity: number;
  readonly refillsAt: Date;
}
```

### 6.2 Retry Policy

```typescript
// packages/providers/src/infrastructure/retry-policy.ts

import type { ProviderResult, ProviderError } from '../domain/provider-result.js';
import { ProviderErrorType } from '../domain/provider-result.js';

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly jitter: boolean;
  readonly retryableErrors: ReadonlySet<ProviderErrorType>;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: new Set([
    ProviderErrorType.NETWORK_ERROR,
    ProviderErrorType.RATE_LIMITED,
    ProviderErrorType.PROVIDER_UNAVAILABLE,
  ]),
};

export class RetryPolicy {
  constructor(private readonly config: RetryConfig) {}

  async execute<T>(
    operation: () => Promise<ProviderResult<T>>,
    context: { providerId: string; operation: string },
  ): Promise<ProviderResult<T>> {
    let lastError: ProviderError | null = null;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const result = await operation();

      if (result.ok) return result;

      lastError = result;

      if (!this.config.retryableErrors.has(result.error)) {
        return result;
      }

      if (attempt === this.config.maxAttempts) break;

      const delay = this.calculateDelay(attempt, result);
      await this.sleep(delay);
    }

    return lastError!;
  }

  private calculateDelay(attempt: number, error: ProviderError): number {
    if (error.error === ProviderErrorType.RATE_LIMITED && error.meta?.rateLimit?.resetAt) {
      const retryAfter = error.meta.rateLimit.resetAt.getTime() - Date.now();
      if (retryAfter > 0 && retryAfter < this.config.maxDelayMs) {
        return retryAfter;
      }
    }

    let delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.config.maxDelayMs);

    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

## 7. Error Handling

```typescript
// packages/providers/src/domain/errors.ts

import { ProviderErrorType } from './provider-result.js';

export abstract class ProviderErrorBase extends Error {
  abstract readonly type: ProviderErrorType;
  abstract readonly retryable: boolean;

  constructor(
    message: string,
    readonly providerId: string,
    readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      message: this.message,
      providerId: this.providerId,
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}

export class ProviderNetworkError extends ProviderErrorBase {
  readonly type = ProviderErrorType.NETWORK_ERROR;
  readonly retryable = true;
}

export class ProviderAuthenticationError extends ProviderErrorBase {
  readonly type = ProviderErrorType.AUTHENTICATION_ERROR;
  readonly retryable = false;
}

export class ProviderRateLimitError extends ProviderErrorBase {
  readonly type = ProviderErrorType.RATE_LIMITED;
  readonly retryable = true;

  constructor(
    providerId: string,
    readonly retryAfterMs: number,
    cause?: Error,
  ) {
    super(`Rate limited by ${providerId}. Retry after ${retryAfterMs}ms`, providerId, cause);
  }
}

export class ProviderNotFoundError extends ProviderErrorBase {
  readonly type = ProviderErrorType.NOT_FOUND;
  readonly retryable = false;
}

export class ProviderInvalidResponseError extends ProviderErrorBase {
  readonly type = ProviderErrorType.INVALID_RESPONSE;
  readonly retryable = false;

  constructor(
    providerId: string,
    readonly statusCode: number,
    readonly responseBody?: string,
    cause?: Error,
  ) {
    super(`Invalid response from ${providerId}: HTTP ${statusCode}`, providerId, cause);
  }
}

export class ProviderUnavailableError extends ProviderErrorBase {
  readonly type = ProviderErrorType.PROVIDER_UNAVAILABLE;
  readonly retryable = true;
}

export class ProviderConfigurationError extends ProviderErrorBase {
  readonly type = ProviderErrorType.CONFIGURATION_ERROR;
  readonly retryable = false;
}
```

## 8. Deduplication Strategy

```typescript
// packages/providers/src/dedup/deduplication-engine.ts

import type { NormalizedVacancy } from '../domain/normalized-vacancy.js';

export interface DeduplicationConfig {
  readonly keyFields: ReadonlyArray<keyof NormalizedVacancy>;
  readonly similarityThreshold: number;
  readonly timeWindowMs: number;
}

export interface DeduplicationResult {
  readonly unique: NormalizedVacancy[];
  readonly duplicates: DeduplicatedGroup[];
  readonly stats: DeduplicationStats;
}

export interface DeduplicatedGroup {
  readonly canonical: NormalizedVacancy;
  readonly all: NormalizedVacancy[];
  readonly sources: string[];
}

export interface DeduplicationStats {
  readonly totalInput: number;
  readonly uniqueOutput: number;
  readonly duplicatesFound: number;
  readonly durationMs: number;
}

export class DeduplicationEngine {
  private seenKeys = new Map<string, NormalizedVacancy>();

  constructor(private readonly config: DeduplicationConfig) {}

  deduplicate(jobs: NormalizedVacancy[]): DeduplicationResult {
    const startTime = Date.now();
    const unique: NormalizedVacancy[] = [];
    const duplicateGroups = new Map<string, DeduplicatedGroup>();

    for (const job of jobs) {
      const key = this.generateKey(job);

      if (this.seenKeys.has(key)) {
        const existing = this.seenKeys.get(key)!;
        const groupKey = this.generateKey(existing);

        if (!duplicateGroups.has(groupKey)) {
          duplicateGroups.set(groupKey, {
            canonical: existing,
            all: [existing],
            sources: [existing.source],
          });
        }

        const group = duplicateGroups.get(groupKey)!;
        group.all.push(job);
        if (!group.sources.includes(job.source)) {
          group.sources.push(job.source);
        }
      } else {
        this.seenKeys.set(key, job);
        unique.push(job);
      }
    }

    return {
      unique,
      duplicates: Array.from(duplicateGroups.values()),
      stats: {
        totalInput: jobs.length,
        uniqueOutput: unique.length,
        duplicatesFound: jobs.length - unique.length,
        durationMs: Date.now() - startTime,
      },
    };
  }

  private generateKey(job: NormalizedVacancy): string {
    const parts = this.config.keyFields.map((field) => {
      const value = job[field];
      if (typeof value === 'string') {
        return value.toLowerCase().trim();
      }
      if (Array.isArray(value)) {
        return [...value].sort().join(',');
      }
      return String(value);
    });

    return parts.join('::');
  }

  clear(): void {
    this.seenKeys.clear();
  }
}
```

## 9. Package Structure

```
packages/providers/
├── src/
│   ├── domain/
│   │   ├── normalized-vacancy.ts      # Single domain model
│   │   ├── provider-info.ts           # Static provider metadata
│   │   ├── provider-capabilities.ts   # Structured capabilities
│   │   ├── provider-state.ts          # Operational state
│   │   ├── provider-result.ts         # Result type with errors
│   │   ├── sync-cursor.ts             # Pagination abstraction
│   │   ├── provider-job.ts            # Orchestrator interface
│   │   ├── default-provider-job.ts    # Default orchestrator
│   │   ├── search-criteria.ts         # Search parameters
│   │   ├── raw-job.ts                 # Provider-specific (INTERNAL)
│   │   └── errors.ts                  # Error hierarchy
│   ├── components/
│   │   ├── fetcher.ts                 # Fetcher interface
│   │   ├── mapper.ts                  # Mapper interface
│   │   ├── normalizer.ts              # Normalizer interface
│   │   └── sync-strategy.ts           # Sync strategy interface
│   ├── normalization/
│   │   ├── normalization-pipeline.ts  # Shared normalization logic
│   │   └── index.ts
│   ├── dedup/
│   │   ├── deduplication-engine.ts    # Dedup logic
│   │   └── index.ts
│   ├── health/
│   │   ├── provider-health-monitor.ts # Health tracking
│   │   └── index.ts
│   ├── scheduler/
│   │   ├── sync-scheduler.ts          # Scheduler interface
│   │   ├── default-schedules.ts       # Default configs
│   │   └── index.ts
│   ├── infrastructure/
│   │   ├── rate-limiter.ts            # Token bucket
│   │   ├── provider-rate-limits.ts    # Per-provider limits
│   │   ├── retry-policy.ts            # Retry with backoff
│   │   └── index.ts
│   ├── providers/                     # Provider implementations
│   │   ├── hh/                        # HH.ru adapter
│   │   │   ├── hh-fetcher.ts
│   │   │   ├── hh-mapper.ts
│   │   │   ├── hh-normalizer.ts
│   │   │   ├── hh-sync-strategy.ts
│   │   │   └── index.ts
│   │   ├── habr-career/               # Habr Career adapter
│   │   ├── remote-ok/                 # RemoteOK adapter
│   │   └── linkedin/                  # LinkedIn (future)
│   └── index.ts                       # Public API
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Alternatives Considered

### 1. Plugin-Based Provider Loading

Dynamic import of providers at runtime.

**Rejected because:**
- Adds complexity to bundling
- Harder to type-check
- Runtime errors instead of compile-time
- Not needed for MVP with known providers

### 2. GraphQL Federation for Providers

Each provider as a federated subgraph.

**Rejected because:**
- Massive over-engineering
- Adds GraphQL dependency
- Providers don't expose GraphQL
- REST + normalization is simpler

### 3. Event-Driven Provider Communication

Providers emit events, consumers react.

**Rejected because:**
- Adds async complexity
- Harder to debug
- Request/response is sufficient for job fetching
- Events better suited for notifications

## References

- ADR-003: Provider/Adapter Pattern
- ADR-008: Provider-Based Architecture
- ADR-009: AI Provider Abstraction
- ADR-013: LinkedIn Integration Strategy
- ADR-019: Rate Limiting Strategy

# ADR-023: Job Processing Pipeline

## Status

Draft

## Date

2026-07-15

## Context

ADR-022 defined the Provider SDK: interfaces for fetching, mapping, normalizing, and deduplicating vacancies from external sources. That SDK covers the provider-facing half of the job lifecycle. The另一半 remains undesigned: what happens after normalization? How do vacancies flow through enrichment, AI matching, scoring, persistence, and notification? How do we handle partial failures across a 13-stage pipeline without losing data or duplicating work?

CareerOS processes vacancies from multiple sources (HH, LinkedIn, Habr Career, RemoteOK, etc.) on a schedule. Each vacancy must travel through a deterministic pipeline where each stage has clear inputs, outputs, retry boundaries, and failure modes. The pipeline must be idempotent (re-running produces no duplicates), observable (metrics at every stage), and recoverable (failures don't require full reprocessing).

## Decision

We define a 13-stage job processing pipeline with type-safe stage interfaces, BullMQ-backed orchestration, and per-stage retry/observability boundaries.

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Job Processing Pipeline                              │
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │Scheduler │───>│ Provider │───>│ Provider │───>│ Fetcher  │             │
│  │          │    │ Registry │    │          │    │          │             │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘             │
│                                                        │                    │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────▼─────┐             │
│  │Notification│<│Scoring  │<───│ AI Match │<───│ Enrichment│             │
│  │          │    │          │    │          │    │          │             │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘             │
│                                                        │                    │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────▼─────┐             │
│  │Persistenc│<───│ Dedup    │<───│ Normaliz.│<───│ Mapper   │             │
│  │          │    │          │    │          │    │          │             │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Pipeline Stage Definitions

Each stage is a typed function with explicit input/output contracts. Stages are grouped into pipeline phases for retry and observability purposes.

```typescript
// packages/pipeline/src/stages/stage-types.ts

/**
 * Branded type for pipeline run identifiers.
 * Ensures run IDs cannot be confused with other string IDs.
 */
export type PipelineRunId = string & { readonly __brand: 'PipelineRunId' };

/**
 * Branded type for stage execution identifiers.
 */
export type StageExecutionId = string & { readonly __brand: 'StageExecutionId' };

export function createPipelineRunId(): PipelineRunId {
  return crypto.randomUUID() as PipelineRunId;
}

export function createStageExecutionId(): StageExecutionId {
  return crypto.randomUUID() as StageExecutionId;
}

/**
 * Every stage receives this context.
 * Immutable within a stage; new context created for next stage.
 */
export interface StageContext {
  readonly runId: PipelineRunId;
  readonly providerId: string;
  readonly workspaceId: string;
  readonly startedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Discriminated union for stage results.
 * Each stage must return exactly one variant.
 */
export type StageResult<T> =
  | StageSuccess<T>
  | StageSkipped
  | StageFailure;

export interface StageSuccess<T> {
  readonly status: 'success';
  readonly data: T;
  readonly durationMs: number;
  readonly warnings: readonly string[];
}

export interface StageSkipped {
  readonly status: 'skipped';
  readonly reason: string;
  readonly durationMs: number;
}

export interface StageFailure {
  readonly status: 'failure';
  readonly error: PipelineError;
  readonly retryable: boolean;
  readonly durationMs: number;
}

export interface PipelineError {
  readonly code: string;
  readonly message: string;
  readonly stage: string;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;
}
```

### 2. Stage Interfaces

#### Stage 1: Scheduler

Triggers pipeline runs based on provider schedules, user actions, or system events.

```typescript
// packages/pipeline/src/stages/scheduler.ts

import type { PipelineRunId, StageContext, StageResult } from './stage-types.js';

export interface ScheduleTrigger {
  readonly type: 'cron' | 'user_initiated' | 'event_driven' | 'manual';
  readonly providerIds: readonly string[];
  readonly workspaceId: string;
  readonly priority: SchedulePriority;
  readonly metadata?: Record<string, unknown>;
}

export type SchedulePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ScheduleConfig {
  readonly providerId: string;
  readonly cronExpression: string;
  readonly enabled: boolean;
  readonly priority: SchedulePriority;
  readonly maxConcurrentRuns: number;
  readonly cooldownMs: number;
}

export interface SchedulerOutput {
  readonly runId: PipelineRunId;
  readonly providerId: string;
  readonly trigger: ScheduleTrigger;
  readonly scheduledAt: Date;
}

export interface Scheduler {
  schedule(trigger: ScheduleTrigger): Promise<StageResult<SchedulerOutput>>;
  getSchedules(): Promise<readonly ScheduleConfig[]>;
  getNextRunTime(providerId: string): Promise<Date | null>;
}
```

#### Stage 2: Provider Registry

Selects and initializes the correct provider for the run.

```typescript
// packages/pipeline/src/stages/provider-registry.ts

import type { StageContext, StageResult } from './stage-types.js';

export interface ProviderRegistryInput {
  readonly providerId: string;
  readonly workspaceId: string;
  readonly config?: Record<string, unknown>;
}

export interface ProviderRegistryOutput {
  readonly providerJob: unknown; // ProviderJob from ADR-022
  readonly info: { readonly id: string; readonly name: string; readonly version: string };
  readonly capabilities: unknown; // ProviderCapabilities from ADR-022
}

export interface ProviderRegistry {
  resolve(input: ProviderRegistryInput): Promise<StageResult<ProviderRegistryOutput>>;
  isHealthy(providerId: string): Promise<boolean>;
}
```

#### Stage 3: Provider (Fetch Orchestration)

Orchestrates the fetch-map-normalize cycle within the provider layer (ADR-022 ProviderJob).

```typescript
// packages/pipeline/src/stages/provider-fetch.ts

import type { StageContext, StageResult } from './stage-types.js';

export interface ProviderFetchInput {
  readonly providerId: string;
  readonly searchCriteria: unknown; // SearchCriteria from ADR-022
  readonly syncCursor?: unknown; // SyncCursor from ADR-022
}

export interface ProviderFetchOutput {
  readonly rawJobs: readonly unknown[]; // RawJob[] from ADR-022
  readonly cursorState: unknown; // CursorState from ADR-022
  readonly fetchMeta: {
    readonly totalPages: number;
    readonly currentPage: number;
    readonly totalResults: number;
    readonly durationMs: number;
  };
}

export interface ProviderFetch {
  fetch(input: ProviderFetchInput): Promise<StageResult<ProviderFetchOutput>>;
}
```

#### Stage 4: Mapper

Transforms provider-specific raw data into an intermediate format.

```typescript
// packages/pipeline/src/stages/mapper.ts

import type { StageContext, StageResult } from './stage-types.js';

export interface MapperInput {
  readonly rawJobs: readonly unknown[];
  readonly providerId: string;
}

export interface MapperOutput {
  readonly mappedJobs: readonly MappedVacancy[];
  readonly stats: {
    readonly total: number;
    readonly succeeded: number;
    readonly failed: number;
    readonly failures: readonly MapFailure[];
  };
}

export interface MappedVacancy {
  readonly sourceId: string;
  readonly title: string;
  readonly description: string;
  readonly companyName: string;
  readonly location: { readonly raw: string; readonly city?: string; readonly country?: string };
  readonly salary?: { readonly min?: number; readonly max?: number; readonly currency: string };
  readonly experienceLevel?: string;
  readonly technologies: readonly string[];
  readonly url: string;
  readonly publishedAt: Date;
  readonly remote?: boolean;
  readonly employmentType?: string;
}

export interface MapFailure {
  readonly sourceId: string;
  readonly reason: string;
}

export interface Mapper {
  map(input: MapperInput): Promise<StageResult<MapperOutput>>;
}
```

#### Stage 5: Normalizer

Converts mapped vacancies into the single NormalizedVacancy domain model.

```typescript
// packages/pipeline/src/stages/normalizer.ts

import type { StageContext, StageResult } from './stage-types.js';
import type { MappedVacancy } from './mapper.js';
import type { NormalizedVacancy } from '@careeros/providers'; // from ADR-022

export interface NormalizerInput {
  readonly mappedJobs: readonly MappedVacancy[];
  readonly providerId: string;
}

export interface NormalizerOutput {
  readonly normalized: readonly NormalizedVacancy[];
  readonly stats: {
    readonly total: number;
    readonly succeeded: number;
    readonly failed: number;
    readonly warnings: number;
  };
  readonly failures: readonly NormalizationFailure[];
}

export interface NormalizationFailure {
  readonly sourceId: string;
  readonly field: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface Normalizer {
  normalize(input: NormalizerInput): Promise<StageResult<NormalizerOutput>>;
}
```

#### Stage 6: Deduplication

Removes duplicate vacancies within and across providers.

```typescript
// packages/pipeline/src/stages/deduplication.ts

import type { StageContext, StageResult } from './stage-types.js';
import type { NormalizedVacancy } from '@careeros/providers';

export interface DeduplicationInput {
  readonly vacancies: readonly NormalizedVacancy[];
  readonly workspaceId: string;
  readonly strategy: DedupStrategy;
}

export type DedupStrategy =
  | 'exact_hash'      // contentHash match
  | 'fuzzy_title'     // title + company similarity
  | 'composite';      // exact_hash + fuzzy_title fallback

export interface DeduplicationOutput {
  readonly unique: readonly NormalizedVacancy[];
  readonly duplicates: readonly DedupGroup[];
  readonly stats: {
    readonly inputCount: number;
    readonly outputCount: number;
    readonly duplicateCount: number;
    readonly crossProviderDuplicates: number;
  };
}

export interface DedupGroup {
  readonly canonical: NormalizedVacancy;
  readonly duplicates: readonly NormalizedVacancy[];
  readonly sources: readonly string[];
}

export interface Deduplicator {
  deduplicate(input: DeduplicationInput): Promise<StageResult<DeduplicationOutput>>;
}
```

#### Stage 7: Enrichment

Augments vacancy data with external information (company details, salary benchmarks, tech stack analysis).

```typescript
// packages/pipeline/src/stages/enrichment.ts

import type { StageContext, StageResult } from './stage-types.js';
import type { NormalizedVacancy } from '@careeros/providers';

export interface EnrichmentInput {
  readonly vacancies: readonly NormalizedVacancy[];
  readonly workspaceId: string;
  readonly enrichments: readonly EnrichmentType[];
}

export type EnrichmentType =
  | 'company_details'
  | 'salary_benchmark'
  | 'tech_stack'
  | 'company_rating'
  | 'location_details';

export interface EnrichmentOutput {
  readonly enriched: readonly EnrichedVacancy[];
  readonly stats: {
    readonly total: number;
    readonly enriched: number;
    readonly skipped: number;
    readonly failed: number;
  };
}

export interface EnrichedVacancy {
  readonly vacancy: NormalizedVacancy;
  readonly companyDetails?: CompanyDetails;
  readonly salaryBenchmark?: SalaryBenchmark;
  readonly techStack?: TechStackAnalysis;
}

export interface CompanyDetails {
  readonly name: string;
  readonly industry?: string;
  readonly size?: string;
  readonly founded?: number;
  readonly website?: string;
}

export interface SalaryBenchmark {
  readonly marketMin?: number;
  readonly marketMax?: number;
  readonly marketMedian?: number;
  readonly percentile?: number;
  readonly source: string;
}

export interface TechStackAnalysis {
  readonly primaryTechnologies: readonly string[];
  readonly secondaryTechnologies: readonly string[];
  readonly demandLevel: 'low' | 'medium' | 'high' | 'very_high';
}

export interface Enricher {
  enrich(input: EnrichmentInput): Promise<StageResult<EnrichmentOutput>>;
}
```

#### Stage 8: AI Matching

Evaluates vacancy relevance against user profiles using AI.

```typescript
// packages/pipeline/src/stages/ai-matching.ts

import type { StageContext, StageResult } from './stage-types.js';
import type { EnrichedVacancy } from './enrichment.js';

export interface AiMatchingInput {
  readonly enriched: readonly EnrichedVacancy[];
  readonly userProfile: UserProfile;
  readonly matchConfig: MatchConfig;
}

export interface UserProfile {
  readonly resumeId?: string;
  readonly searchProfileId?: string;
  readonly skills: readonly string[];
  readonly experienceLevel: string;
  readonly preferredLocations: readonly string[];
  readonly preferredRemote: boolean;
  readonly salaryExpectation?: { readonly min: number; readonly max: number };
}

export interface MatchConfig {
  readonly minScore: number;
  readonly maxResults: number;
  readonly includeReasons: boolean;
  readonly aiModel: string;
}

export interface AiMatchingOutput {
  readonly matched: readonly MatchedVacancy[];
  readonly stats: {
    readonly totalEvaluated: number;
    readonly matched: number;
    readonly filtered: number;
    readonly avgScore: number;
    readonly durationMs: number;
  };
}

export interface MatchedVacancy {
  readonly enriched: EnrichedVacancy;
  readonly score: number;
  readonly confidence: number;
  readonly reasons: readonly MatchReason[];
  readonly missingSkills: readonly string[];
}

export interface MatchReason {
  readonly category: 'skill' | 'experience' | 'location' | 'salary' | 'culture';
  readonly description: string;
  readonly weight: number;
  readonly matched: boolean;
}

export interface AiMatcher {
  match(input: AiMatchingInput): Promise<StageResult<AiMatchingOutput>>;
}
```

#### Stage 9: Scoring

Applies final scoring algorithm combining AI match score with business rules.

```typescript
// packages/pipeline/src/stages/scoring.ts

import type { StageContext, StageResult } from './stage-types.js';
import type { MatchedVacancy } from './ai-matching.js';

export interface ScoringInput {
  readonly matched: readonly MatchedVacancy[];
  readonly scoringRules: ScoringRules;
}

export interface ScoringRules {
  readonly weights: {
    readonly aiScore: number;
    readonly recency: number;
    readonly salaryFit: number;
    readonly locationFit: number;
    readonly companyRating: number;
  };
  readonly penalties: {
    readonly expiredPosting: number;
    readonly missingSalary: number;
    readonly vagueDescription: number;
  };
}

export interface ScoringOutput {
  readonly scored: readonly ScoredVacancy[];
  readonly stats: {
    readonly total: number;
    readonly aboveThreshold: number;
    readonly avgScore: number;
  };
}

export interface ScoredVacancy {
  readonly matched: MatchedVacancy;
  readonly finalScore: number;
  readonly tier: VacancyTier;
  readonly scoreBreakdown: ScoreBreakdown;
}

export type VacancyTier = 'hot' | 'warm' | 'cold' | 'rejected';

export interface ScoreBreakdown {
  readonly aiScore: number;
  readonly recencyScore: number;
  readonly salaryScore: number;
  readonly locationScore: number;
  readonly companyScore: number;
  readonly penalties: readonly { readonly reason: string; readonly amount: number }[];
}

export interface Scorer {
  score(input: ScoringInput): Promise<StageResult<ScoringOutput>>;
}
```

#### Stage 10: Persistence

Saves vacancies and match results to the database.

```typescript
// packages/pipeline/src/stages/persistence.ts

import type { StageContext, StageResult } from './stage-types.js';
import type { ScoredVacancy } from './scoring.js';

export interface PersistenceInput {
  readonly scored: readonly ScoredVacancy[];
  readonly workspaceId: string;
  readonly upsertStrategy: UpsertStrategy;
}

export type UpsertStrategy =
  | 'skip_existing'   // Skip if sourceId + workspaceId exists
  | 'update_existing' // Update existing, insert new
  | 'versioned';      // Create new version, keep history

export interface PersistenceOutput {
  readonly persisted: readonly PersistedVacancy[];
  readonly stats: {
    readonly inserted: number;
    readonly updated: number;
    readonly skipped: number;
    readonly failed: number;
  };
  readonly failures: readonly PersistenceFailure[];
}

export interface PersistedVacancy {
  readonly vacancyId: string; // Domain entity ID
  readonly sourceId: string;
  readonly isNew: boolean;
  readonly score: number;
  readonly tier: string;
}

export interface PersistenceFailure {
  readonly sourceId: string;
  readonly reason: string;
  readonly error: Error;
}

export interface Persister {
  persist(input: PersistenceInput): Promise<StageResult<PersistenceOutput>>;
}
```

#### Stage 11: Notification

Sends notifications about new/updated vacancies to users.

```typescript
// packages/pipeline/src/stages/notification.ts

import type { StageContext, StageResult } from './stage-types.js';
import type { PersistedVacancy } from './persistence.js';

export interface NotificationInput {
  readonly persisted: readonly PersistedVacancy[];
  readonly workspaceId: string;
  readonly notificationConfig: NotificationConfig;
}

export interface NotificationConfig {
  readonly channels: readonly NotificationChannel[];
  readonly minTier: string;
  readonly batchSize: number;
  readonly deduplicateWithinMs: number;
}

export type NotificationChannel = 'telegram' | 'email' | 'push' | 'webhook';

export interface NotificationOutput {
  readonly sent: readonly NotificationResult[];
  readonly stats: {
    readonly total: number;
    readonly sent: number;
    readonly skipped: number;
    readonly failed: number;
  };
}

export interface NotificationResult {
  readonly channel: NotificationChannel;
  readonly vacancyCount: number;
  readonly success: boolean;
  readonly error?: string;
}

export interface Notifier {
  notify(input: NotificationInput): Promise<StageResult<NotificationOutput>>;
}
```

### 3. Pipeline Orchestrator

The orchestrator chains stages together with error boundaries and observability.

```typescript
// packages/pipeline/src/orchestrator/pipeline-orchestrator.ts

import type { PipelineRunId, StageContext, StageResult, StageFailure } from '../stages/stage-types.js';

export interface PipelineConfig {
  readonly maxConcurrency: number;
  readonly stageTimeoutMs: number;
  readonly retryPolicy: PipelineRetryPolicy;
  readonly deadLetterQueue: boolean;
  readonly observability: ObservabilityConfig;
}

export interface PipelineRetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly retryableStages: readonly string[];
}

export interface ObservabilityConfig {
  readonly metricsEnabled: boolean;
  readonly loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly tracingEnabled: boolean;
  readonly dashboardEnabled: boolean;
}

export interface PipelineRun {
  readonly runId: PipelineRunId;
  readonly status: PipelineRunStatus;
  readonly stages: readonly StageExecution[];
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly error?: StageFailure;
}

export type PipelineRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'cancelled';

export interface StageExecution {
  readonly stageName: string;
  readonly status: StageResult<unknown>['status'];
  readonly durationMs: number;
  readonly inputSize: number;
  readonly outputSize: number;
  readonly error?: string;
  readonly retryCount: number;
}

export interface PipelineOrchestrator {
  execute(context: StageContext): Promise<PipelineRun>;
  getRun(runId: PipelineRunId): Promise<PipelineRun | null>;
  cancelRun(runId: PipelineRunId): Promise<void>;
  getRunsByProvider(providerId: string, limit?: number): Promise<readonly PipelineRun[]>;
}
```

### 4. Retry Boundaries

Each stage has independent retry behavior. Retries happen at the stage level, not the pipeline level.

```typescript
// packages/pipeline/src/retry/stage-retry.ts

import type { StageResult, StageFailure } from '../stages/stage-types.js';

export interface StageRetryConfig {
  readonly stageName: string;
  readonly maxAttempts: number;
  readonly backoff: 'exponential' | 'linear' | 'fixed';
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableErrors: readonly string[];
  readonly timeoutMs: number;
}

export const STAGE_RETRY_CONFIGS: Readonly<Record<string, StageRetryConfig>> = {
  scheduler: {
    stageName: 'scheduler',
    maxAttempts: 1,      // No retry — reschedule instead
    backoff: 'fixed',
    baseDelayMs: 0,
    maxDelayMs: 0,
    retryableErrors: [],
    timeoutMs: 5_000,
  },
  provider_registry: {
    stageName: 'provider_registry',
    maxAttempts: 2,      // One retry for transient init failures
    backoff: 'exponential',
    baseDelayMs: 1_000,
    maxDelayMs: 5_000,
    retryableErrors: ['PROVIDER_UNAVAILABLE', 'NETWORK_ERROR'],
    timeoutMs: 10_000,
  },
  provider_fetch: {
    stageName: 'provider_fetch',
    maxAttempts: 3,      // Provider rate limits, network issues
    backoff: 'exponential',
    baseDelayMs: 2_000,
    maxDelayMs: 30_000,
    retryableErrors: ['NETWORK_ERROR', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE'],
    timeoutMs: 60_000,
  },
  mapper: {
    stageName: 'mapper',
    maxAttempts: 1,      // No retry — data issue, not transient
    backoff: 'fixed',
    baseDelayMs: 0,
    maxDelayMs: 0,
    retryableErrors: [],
    timeoutMs: 10_000,
  },
  normalizer: {
    stageName: 'normalizer',
    maxAttempts: 1,      // No retry — validation failure
    backoff: 'fixed',
    baseDelayMs: 0,
    maxDelayMs: 0,
    retryableErrors: [],
    timeoutMs: 10_000,
  },
  deduplication: {
    stageName: 'deduplication',
    maxAttempts: 2,      // Retry on DB connection issues
    backoff: 'exponential',
    baseDelayMs: 1_000,
    maxDelayMs: 5_000,
    retryableErrors: ['DATABASE_ERROR', 'TIMEOUT'],
    timeoutMs: 30_000,
  },
  enrichment: {
    stageName: 'enrichment',
    maxAttempts: 2,      // External API calls
    backoff: 'exponential',
    baseDelayMs: 2_000,
    maxDelayMs: 15_000,
    retryableErrors: ['NETWORK_ERROR', 'RATE_LIMITED'],
    timeoutMs: 30_000,
  },
  ai_matching: {
    stageName: 'ai_matching',
    maxAttempts: 2,      // AI API transient failures
    backoff: 'exponential',
    baseDelayMs: 3_000,
    maxDelayMs: 30_000,
    retryableErrors: ['AI_PROVIDER_ERROR', 'RATE_LIMITED', 'TIMEOUT'],
    timeoutMs: 120_000,
  },
  scoring: {
    stageName: 'scoring',
    maxAttempts: 1,      // No retry — deterministic calculation
    backoff: 'fixed',
    baseDelayMs: 0,
    maxDelayMs: 0,
    retryableErrors: [],
    timeoutMs: 10_000,
  },
  persistence: {
    stageName: 'persistence',
    maxAttempts: 3,      // DB transient issues
    backoff: 'exponential',
    baseDelayMs: 1_000,
    maxDelayMs: 10_000,
    retryableErrors: ['DATABASE_ERROR', 'TIMEOUT', 'CONFLICT'],
    timeoutMs: 30_000,
  },
  notification: {
    stageName: 'notification',
    maxAttempts: 3,      // Notification service issues
    backoff: 'exponential',
    baseDelayMs: 2_000,
    maxDelayMs: 20_000,
    retryableErrors: ['NETWORK_ERROR', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE'],
    timeoutMs: 30_000,
  },
};
```

### 5. Failure Recovery

Each stage can fail independently. The pipeline records partial progress and supports resume.

```typescript
// packages/pipeline/src/recovery/failure-recovery.ts

import type { PipelineRunId, StageFailure } from '../stages/stage-types.js';

export interface PipelineCheckpoint {
  readonly runId: PipelineRunId;
  readonly completedStages: readonly string[];
  readonly lastSuccessfulStage: string;
  readonly lastOutput: unknown;
  readonly failedStage: string;
  readonly failure: StageFailure;
  readonly createdAt: Date;
}

export interface RecoveryStrategy {
  readonly type: 'retry' | 'skip' | 'fallback' | 'abort';
  readonly description: string;
}

export interface FailureRecovery {
  /**
   * Determine recovery strategy for a failed stage.
   */
  analyze(failure: StageFailure, checkpoint: PipelineCheckpoint): RecoveryStrategy;

  /**
   * Resume pipeline from checkpoint (skip completed stages).
   */
  resume(checkpoint: PipelineCheckpoint): Promise<void>;

  /**
   * Move failed run to dead letter queue for manual investigation.
   */
  moveToDeadLetter(checkpoint: PipelineCheckpoint): Promise<void>;

  /**
   * Get all checkpoints for a run (for debugging).
   */
  getCheckpoints(runId: PipelineRunId): Promise<readonly PipelineCheckpoint[]>;
}
```

### 6. Idempotency Strategy

Pipeline runs are idempotent at every stage. Re-running produces no duplicates.

```typescript
// packages/pipeline/src/idempotency/idempotency-manager.ts

import type { PipelineRunId } from '../stages/stage-types.js';

export interface IdempotencyKey {
  readonly providerId: string;
  readonly workspaceId: string;
  readonly syncTimestamp: string; // ISO 8601 truncated to minute
}

export interface IdempotencyRecord {
  readonly key: string; // Serialized IdempotencyKey
  readonly runId: PipelineRunId;
  readonly status: 'in_progress' | 'completed' | 'failed';
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly stageProgress: Readonly<Record<string, 'pending' | 'done'>>;
}

export interface IdempotencyManager {
  /**
   * Check if a run with this key is already in progress or completed.
   */
  acquire(key: IdempotencyKey): Promise<IdempotencyRecord | null>;

  /**
   * Mark stage as completed (enables resume from next stage).
   */
  markStageComplete(key: IdempotencyKey, stageName: string): Promise<void>;

  /**
   * Mark run as completed.
   */
  markComplete(key: IdempotencyKey): Promise<void>;

  /**
   * Release lock (for failed runs that should be retried).
   */
  release(key: IdempotencyKey): Promise<void>;

  /**
   * Cleanup old records (TTL-based).
   */
  cleanup(olderThanMs: number): Promise<number>;
}
```

### 7. Observability

Structured logging and metrics at every stage.

```typescript
// packages/pipeline/src/observability/pipeline-metrics.ts

export interface PipelineMetrics {
  // Counters
  incrementCounter(name: string, tags?: Record<string, string>): void;

  // Histograms
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;

  // Gauges
  setGauge(name: string, value: number, tags?: Record<string, string>): void;
}

export const PIPELINE_METRICS = {
  // Pipeline-level
  RUN_STARTED: 'pipeline.run.started',
  RUN_COMPLETED: 'pipeline.run.completed',
  RUN_FAILED: 'pipeline.run.failed',
  RUN_DURATION: 'pipeline.run.duration_ms',

  // Stage-level
  STAGE_STARTED: 'pipeline.stage.started',
  STAGE_COMPLETED: 'pipeline.stage.completed',
  STAGE_FAILED: 'pipeline.stage.failed',
  STAGE_DURATION: 'pipeline.stage.duration_ms',
  STAGE_RETRY: 'pipeline.stage.retry',

  // Business metrics
  VACANCIES_FETCHED: 'pipeline.vacancies.fetched',
  VACANCIES_NORMALIZED: 'pipeline.vacancies.normalized',
  VACANCIES_DEDUPLICATED: 'pipeline.vacancies.deduplicated',
  VACANCIES_ENRICHED: 'pipeline.vacancies.enriched',
  VACANCIES_MATCHED: 'pipeline.vacancies.matched',
  VACANCIES_PERSISTED: 'pipeline.vacancies.persisted',
  VACANCIES_NOTIFICATION_SENT: 'pipeline.vacancies.notification_sent',

  // Error metrics
  ERRORS_BY_STAGE: 'pipeline.errors.by_stage',
  ERRORS_BY_TYPE: 'pipeline.errors.by_type',

  // Provider metrics
  PROVIDER_HEALTH: 'pipeline.provider.health',
  PROVIDER_LATENCY: 'pipeline.provider.latency_ms',
  PROVIDER_RATE_LIMIT: 'pipeline.provider.rate_limit',
} as const;

export interface PipelineLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}
```

### 8. Performance Constraints

```typescript
// packages/pipeline/src/config/performance-constraints.ts

export interface PipelinePerformanceConfig {
  /** Maximum total pipeline execution time */
  readonly maxPipelineDurationMs: number;

  /** Maximum concurrent pipeline runs */
  readonly maxConcurrentRuns: number;

  /** Maximum vacancies per pipeline run */
  readonly maxVacanciesPerRun: number;

  /** Maximum batch size for persistence */
  readonly persistenceBatchSize: number;

  /** Maximum batch size for AI matching */
  readonly aiMatchingBatchSize: number;

  /** Maximum batch size for notifications */
  readonly notificationBatchSize: number;

  /** Pipeline stage timeouts */
  readonly stageTimeouts: Readonly<Record<string, number>>;
}

export const DEFAULT_PERFORMANCE_CONFIG: PipelinePerformanceConfig = {
  maxPipelineDurationMs: 300_000,  // 5 minutes
  maxConcurrentRuns: 5,
  maxVacanciesPerRun: 1_000,
  persistenceBatchSize: 100,
  aiMatchingBatchSize: 50,
  notificationBatchSize: 25,
  stageTimeouts: {
    scheduler: 5_000,
    provider_registry: 10_000,
    provider_fetch: 60_000,
    mapper: 10_000,
    normalizer: 10_000,
    deduplication: 30_000,
    enrichment: 30_000,
    ai_matching: 120_000,
    scoring: 10_000,
    persistence: 30_000,
    notification: 30_000,
  },
};
```

## Consequences

### Positive

- Each stage has clear input/output contracts — easy to test in isolation
- Per-stage retry boundaries prevent cascading failures
- Idempotency ensures safe re-runs (BullMQ retries, manual triggers)
- Checkpoint-based recovery avoids full reprocessing on failure
- Structured metrics enable dashboards and alerting
- Type-safe stage results (discriminated union) prevent runtime errors
- Batch processing constraints prevent memory exhaustion

### Negative

- 13 stages add conceptual complexity
- Checkpoint storage requires additional DB tables
- AI matching stage is the bottleneck (latency and cost)
- Idempotency key design needs careful consideration per provider

### Mitigations

- Start with subset of stages (fetch → normalize → dedup → persist); add enrichment/AI matching later
- Checkpoint storage uses existing PostgreSQL with TTL-based cleanup
- AI matching can be deferred (async queue) or batched
- Idempotency keys use provider + workspace + minute-granularity timestamp

## Pipeline Stages Summary

| # | Stage | Input | Output | Retry | Timeout |
|---|-------|-------|--------|-------|---------|
| 1 | Scheduler | ScheduleTrigger | SchedulerOutput | 0 | 5s |
| 2 | Provider Registry | ProviderRegistryInput | ProviderRegistryOutput | 1 | 10s |
| 3 | Provider Fetch | ProviderFetchInput | ProviderFetchOutput | 2 | 60s |
| 4 | Mapper | MapperInput | MapperOutput | 0 | 10s |
| 5 | Normalizer | NormalizerInput | NormalizerOutput | 0 | 10s |
| 6 | Deduplication | DeduplicationInput | DeduplicationOutput | 1 | 30s |
| 7 | Enrichment | EnrichmentInput | EnrichmentOutput | 1 | 30s |
| 8 | AI Matching | AiMatchingInput | AiMatchingOutput | 1 | 120s |
| 9 | Scoring | ScoringInput | ScoringOutput | 0 | 10s |
| 10 | Persistence | PersistenceInput | PersistenceOutput | 2 | 30s |
| 11 | Notification | NotificationInput | NotificationOutput | 2 | 30s |

## Package Structure

```
packages/pipeline/
├── src/
│   ├── stages/
│   │   ├── stage-types.ts          # Core types (StageResult, StageContext)
│   │   ├── scheduler.ts            # Stage 1: Schedule trigger
│   │   ├── provider-registry.ts    # Stage 2: Provider selection
│   │   ├── provider-fetch.ts       # Stage 3: Data fetching
│   │   ├── mapper.ts               # Stage 4: Raw → intermediate
│   │   ├── normalizer.ts           # Stage 5: Intermediate → domain
│   │   ├── deduplication.ts        # Stage 6: Remove duplicates
│   │   ├── enrichment.ts           # Stage 7: Augment data
│   │   ├── ai-matching.ts          # Stage 8: AI relevance scoring
│   │   ├── scoring.ts              # Stage 9: Final scoring
│   │   ├── persistence.ts          # Stage 10: Database save
│   │   ├── notification.ts         # Stage 11: User notification
│   │   └── index.ts
│   ├── orchestrator/
│   │   ├── pipeline-orchestrator.ts # Main orchestrator
│   │   ├── stage-executor.ts       # Single stage execution
│   │   └── index.ts
│   ├── retry/
│   │   ├── stage-retry.ts          # Per-stage retry configs
│   │   ├── retry-executor.ts       # Retry logic
│   │   └── index.ts
│   ├── recovery/
│   │   ├── failure-recovery.ts     # Checkpoint-based recovery
│   │   ├── dead-letter.ts          # Dead letter queue
│   │   └── index.ts
│   ├── idempotency/
│   │   ├── idempotency-manager.ts  # Idempotency keys
│   │   └── index.ts
│   ├── observability/
│   │   ├── pipeline-metrics.ts     # Metric definitions
│   │   ├── pipeline-logger.ts      # Structured logging
│   │   └── index.ts
│   ├── config/
│   │   ├── performance-constraints.ts # Performance limits
│   │   └── index.ts
│   └── index.ts                    # Public API
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Alternatives Considered

### 1. Monolithic Pipeline Function

Single async function with try/catch for all stages.

**Rejected because:**
- No per-stage retry boundaries
- No checkpoint/resume capability
- Hard to add observability per stage
- Difficult to test individual stages

### 2. Event-Driven Pipeline

Each stage emits events, next stage subscribes.

**Rejected because:**
- Adds async complexity
- Harder to debug pipeline flow
- No natural checkpoint mechanism
- Over-engineering for sequential processing

### 3. Temporal Workflow Engine

Use Temporal.io for pipeline orchestration.

**Rejected because:**
- External dependency (Temporal server)
- Adds operational complexity
- Overkill for MVP pipeline
- Can migrate later if needed

## References

- ADR-007: Redis + BullMQ for Queue System
- ADR-008: Provider-Based Architecture
- ADR-022: Provider SDK Architecture
- ADR-021: Testing Strategy (for pipeline tests)

// Types
export type { ExperienceLevel, EmploymentType, RemoteLevel, LocationInfo, SalaryInfo, RemoteInfo } from './types/vacancy.js';
export type { AuthType, PaginationStrategy, SchedulePriority } from './types/provider.js';

// Errors
export {
  ProviderErrorType,
  ProviderNetworkError,
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderNotFoundError,
  ProviderInvalidResponseError,
  ProviderUnavailableError,
  ProviderConfigurationError,
  ProviderUnknownError,
} from './errors/provider-errors.js';

// Interfaces
export type { ProviderResult, ProviderSuccess, ProviderError, ResultMeta, RateLimitInfo } from './interfaces/result.js';
export type { NormalizedVacancy } from './interfaces/normalized-vacancy.js';
export type { ProviderInfo, AuthRequirements } from './interfaces/provider-info.js';
export type {
  ProviderCapabilities,
  SearchCapabilities,
  PaginationCapabilities,
  SyncCapabilities,
  FilteringCapabilities,
  RateLimitCapabilities,
  ResponseCharacteristics,
} from './interfaces/provider-capabilities.js';
export type {
  SyncCursor,
  CursorState,
  CursorCursor,
  PageCursor,
  OffsetCursor,
  TimestampCursor,
  NoCursor,
} from './interfaces/sync-cursor.js';
export { createInitialCursor, advanceCursor } from './interfaces/sync-cursor.js';
export type { ProviderState, ProviderStateUpdate, HealthState } from './interfaces/provider-state.js';
export { createInitialState } from './interfaces/provider-state.js';
export type { SearchCriteria } from './interfaces/search-criteria.js';
export type { RawJob, RawSalary } from './interfaces/raw-job.js';
export type { Fetcher, FetchResult } from './interfaces/fetcher.js';
export type { Mapper, MappedJob } from './interfaces/mapper.js';
export type {
  Normalizer,
  NormalizationError,
  NormalizationResult,
  NormalizationFailure,
  NormalizationStats,
} from './interfaces/normalizer.js';
export type {
  SyncStrategy,
  SyncStrategyResult,
  SyncMetrics,
} from './interfaces/sync-strategy.js';
export type {
  ProviderJob,
  ProviderConfig,
  SearchResult,
  SyncResult,
  ProviderHealthCheckResult,
} from './interfaces/provider-job.js';
export type {
  ProviderDiagnostics,
  ProviderFetchDiagnostics,
  ProviderAuthStatus,
} from './interfaces/provider-diagnostics.js';
export { DefaultProviderJob } from './interfaces/default-provider-job.js';
export { DefaultSyncStrategy } from './interfaces/default-sync-strategy.js';

// Registry
export { ProviderRegistry } from './registry/provider-registry.js';
export { ProviderNotFoundError as RegistryProviderNotFoundError } from './registry/provider-registry.js';

// Scheduler
export type { ScheduleTrigger, ScheduleConfig, SchedulerOutput, Scheduler } from './scheduler/sync-scheduler.js';
export { DefaultSyncScheduler } from './scheduler/sync-scheduler.js';

// Retry
export { RetryPolicy, DEFAULT_RETRY_CONFIG } from './retry/retry-policy.js';
export type { RetryConfig } from './retry/retry-policy.js';

// Rate Limit
export { TokenBucketRateLimiter } from './rate-limit/rate-limiter.js';
export type { RateLimitConfig, BucketStatus } from './rate-limit/rate-limiter.js';

// Normalization
export { DefaultNormalizationPipeline } from './normalization/normalization-pipeline.js';
export type { NormalizationPipeline } from './normalization/normalization-pipeline.js';

// Deduplication
export { DeduplicationEngine } from './deduplication/deduplication-engine.js';
export type {
  DeduplicationConfig,
  DeduplicationResult,
  DeduplicatedGroup,
  DeduplicationStats,
} from './deduplication/deduplication-engine.js';

// Health
export { ProviderHealthMonitor } from './health/provider-health-monitor.js';
export type {
  HealthMonitorConfig,
  HealthCheckResult,
  ProviderHealthStatus,
} from './health/provider-health-monitor.js';

// Pipeline
export type {
  PipelineRunId,
  StageExecutionId,
  StageContext,
  StageResult,
  StageSuccess,
  StageSkipped,
  StageFailure,
  PipelineError,
} from './pipeline/stage-types.js';
export { createPipelineRunId, createStageExecutionId } from './pipeline/stage-types.js';
export type {
  PipelineConfig,
  PipelineRetryPolicy,
  ObservabilityConfig,
  PipelineRun,
  PipelineRunStatus,
  StageExecution,
  PipelineOrchestrator,
} from './pipeline/pipeline-orchestrator.js';
export { PipelineOrchestratorImpl } from './pipeline/pipeline-orchestrator.js';
export type { StageRetryConfig } from './pipeline/stage-retry.js';
export { STAGE_RETRY_CONFIGS } from './pipeline/stage-retry.js';

// Observability
export type { Logger, LogContext, LogLevel } from './observability/logger.js';
export { ConsoleLogger, NoopLogger } from './observability/logger.js';
export type { MetricsCollector, MetricTags } from './observability/metrics.js';
export { InMemoryMetricsCollector, NoopMetricsCollector, PROVIDER_METRICS } from './observability/metrics.js';
export type { Tracer, Span, SpanAttributes } from './observability/tracer.js';
export { InMemoryTracer, NoopTracer } from './observability/tracer.js';

// RemoteOK Provider
export {
  createRemoteOKProvider,
  REMOTE_OK_PROVIDER_INFO,
  REMOTE_OK_PROVIDER_CAPABILITIES,
} from './providers/remoteok/remoteok-provider.js';
export type { RemoteOKProviderConfig } from './providers/remoteok/remoteok-provider.js';
export { RemoteOKFetcher } from './providers/remoteok/remoteok-fetcher.js';
export { RemoteOKMapper } from './providers/remoteok/remoteok-mapper.js';
export { RemoteOKNormalizer } from './providers/remoteok/remoteok-normalizer.js';
export { RemoteOKSyncStrategy } from './providers/remoteok/remoteok-sync-strategy.js';

// HH Provider
export {
  createHHProvider,
  HH_PROVIDER_INFO,
  HH_PROVIDER_CAPABILITIES,
} from './providers/hh/hh-provider.js';
export type { HHProviderConfig } from './providers/hh/hh-provider.js';
export { HHFetcher } from './providers/hh/hh-fetcher.js';
export { HHMapper } from './providers/hh/hh-mapper.js';
export { HHNormalizer } from './providers/hh/hh-normalizer.js';
export { HHSyncStrategy } from './providers/hh/hh-sync-strategy.js';

// Greenhouse Provider
export {
  createGreenhouseProvider,
  GREENHOUSE_PROVIDER_INFO,
  GREENHOUSE_PROVIDER_CAPABILITIES,
} from './providers/greenhouse/greenhouse-provider.js';
export type { GreenhouseProviderConfig } from './providers/greenhouse/greenhouse-provider.js';
export { GreenhouseFetcher } from './providers/greenhouse/greenhouse-fetcher.js';
export { GreenhouseMapper } from './providers/greenhouse/greenhouse-mapper.js';
export { GreenhouseNormalizer } from './providers/greenhouse/greenhouse-normalizer.js';

// Lever Provider
export {
  createLeverProvider,
  LEVER_PROVIDER_INFO,
  LEVER_PROVIDER_CAPABILITIES,
} from './providers/lever/lever-provider.js';
export type { LeverProviderConfig } from './providers/lever/lever-provider.js';
export { LeverFetcher } from './providers/lever/lever-fetcher.js';
export { LeverMapper } from './providers/lever/lever-mapper.js';
export { LeverNormalizer } from './providers/lever/lever-normalizer.js';

// Ashby Provider
export {
  createAshbyProvider,
  ASHBY_PROVIDER_INFO,
  ASHBY_PROVIDER_CAPABILITIES,
} from './providers/ashby/ashby-provider.js';
export type { AshbyProviderConfig } from './providers/ashby/ashby-provider.js';
export { AshbyFetcher } from './providers/ashby/ashby-fetcher.js';
export { AshbyMapper } from './providers/ashby/ashby-mapper.js';
export { AshbyNormalizer } from './providers/ashby/ashby-normalizer.js';

// Workday Provider
export {
  createWorkdayProvider,
  WORKDAY_PROVIDER_INFO,
  WORKDAY_PROVIDER_CAPABILITIES,
} from './providers/workday/workday-provider.js';
export type { WorkdayProviderConfig } from './providers/workday/workday-provider.js';
export { WorkdayFetcher } from './providers/workday/workday-fetcher.js';
export { WorkdayMapper } from './providers/workday/workday-mapper.js';
export { WorkdayNormalizer } from './providers/workday/workday-normalizer.js';

// Teamtailor Provider
export {
  createTeamtailorProvider,
  TEAMTAILOR_PROVIDER_INFO,
  TEAMTAILOR_PROVIDER_CAPABILITIES,
} from './providers/teamtailor/teamtailor-provider.js';
export type { TeamtailorProviderConfig } from './providers/teamtailor/teamtailor-provider.js';
export { TeamtailorFetcher } from './providers/teamtailor/teamtailor-fetcher.js';
export { TeamtailorMapper } from './providers/teamtailor/teamtailor-mapper.js';
export { TeamtailorNormalizer } from './providers/teamtailor/teamtailor-normalizer.js';

// Testing (fixture-based, no network — for use by consumer test suites and demo scripts)
export { FakeProvider } from './__tests__/fake-provider.js';
export type { FakeProviderBehavior } from './__tests__/fake-provider.js';

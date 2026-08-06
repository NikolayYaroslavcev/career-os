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
  ProviderOperationalStatus,
  BulkSyncStatus,
} from './interfaces/provider-diagnostics.js';
export { DefaultProviderJob } from './interfaces/default-provider-job.js';
export { DefaultSyncStrategy } from './interfaces/default-sync-strategy.js';
export type { TransportCapability } from './interfaces/transport-capability.js';
export type {
  SocialMessageTransport,
  TransportSource,
  TransportCursor,
  TransportFetchResult,
  SocialMessageCandidate,
  SocialMessageValidationError,
} from './interfaces/social-message-transport.js';

// Registry
export { ProviderRegistry } from './registry/provider-registry.js';
export { ProviderNotFoundError as RegistryProviderNotFoundError } from './registry/provider-registry.js';
export { SocialMessageTransportRegistry, TransportNotFoundError } from './registry/social-message-transport-registry.js';

// Transport
export { TransportManager } from './transport/transport-manager.js';
export type {
  TransportManagerConfig,
  TransportFetchOptions,
  TransportLifecycle,
  TransportHealth,
  TransportHealthState,
} from './transport/transport-manager.js';
export { validateSocialMessageCandidate } from './shared/social-message-validation.js';

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
export { InMemoryMetricsCollector, NoopMetricsCollector, PROVIDER_METRICS, TRANSPORT_METRICS } from './observability/metrics.js';
export type { Tracer, Span, SpanAttributes } from './observability/tracer.js';
export { InMemoryTracer, NoopTracer } from './observability/tracer.js';

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

// Remotive Provider
export { createRemotiveProvider, REMOTIVE_PROVIDER_INFO, REMOTIVE_PROVIDER_CAPABILITIES } from './providers/remotive/remotive-provider.js';
export type { RemotiveProviderConfig } from './providers/remotive/remotive-provider.js';
export { RemotiveFetcher } from './providers/remotive/remotive-fetcher.js';
export { RemotiveMapper } from './providers/remotive/remotive-mapper.js';
export { RemotiveNormalizer } from './providers/remotive/remotive-normalizer.js';
export { RemotiveSyncStrategy } from './providers/remotive/remotive-sync-strategy.js';

// Arbeitnow Provider
export { createArbeitnowProvider, ARBEITNOW_PROVIDER_INFO, ARBEITNOW_PROVIDER_CAPABILITIES } from './providers/arbeitnow/arbeitnow-provider.js';
export type { ArbeitnowProviderConfig } from './providers/arbeitnow/arbeitnow-provider.js';
export { ArbeitnowFetcher } from './providers/arbeitnow/arbeitnow-fetcher.js';
export { ArbeitnowMapper } from './providers/arbeitnow/arbeitnow-mapper.js';
export { ArbeitnowNormalizer } from './providers/arbeitnow/arbeitnow-normalizer.js';

// Jobicy Provider
export { createJobicyProvider, JOBICY_PROVIDER_INFO, JOBICY_PROVIDER_CAPABILITIES } from './providers/jobicy/jobicy-provider.js';
export type { JobicyProviderConfig } from './providers/jobicy/jobicy-provider.js';
export { JobicyFetcher } from './providers/jobicy/jobicy-fetcher.js';
export { JobicyMapper } from './providers/jobicy/jobicy-mapper.js';
export { JobicyNormalizer } from './providers/jobicy/jobicy-normalizer.js';

// We Work Remotely Provider
export { createWWRProvider, WWR_PROVIDER_INFO, WWR_PROVIDER_CAPABILITIES } from './providers/weworkremotely/weworkremotely-provider.js';
export type { WWRProviderConfig } from './providers/weworkremotely/weworkremotely-provider.js';
export { WWRFetcher } from './providers/weworkremotely/weworkremotely-fetcher.js';
export { WWRMapper } from './providers/weworkremotely/weworkremotely-mapper.js';
export { WWRNormalizer } from './providers/weworkremotely/weworkremotely-normalizer.js';

// Working Nomads Provider
export { createWorkingNomadsProvider, WORKING_NOMADS_PROVIDER_INFO, WORKING_NOMADS_PROVIDER_CAPABILITIES } from './providers/workingnomads/workingnomads-provider.js';
export type { WorkingNomadsProviderConfig } from './providers/workingnomads/workingnomads-provider.js';
export { WorkingNomadsFetcher } from './providers/workingnomads/workingnomads-fetcher.js';
export { WorkingNomadsMapper } from './providers/workingnomads/workingnomads-mapper.js';
export { WorkingNomadsNormalizer } from './providers/workingnomads/workingnomads-normalizer.js';

// NoDesk Provider
export { createNoDeskProvider, NODESK_PROVIDER_INFO, NODESK_PROVIDER_CAPABILITIES } from './providers/nodesk/nodesk-provider.js';
export type { NoDeskProviderConfig } from './providers/nodesk/nodesk-provider.js';
export { NoDeskFetcher } from './providers/nodesk/nodesk-fetcher.js';
export { NoDeskMapper } from './providers/nodesk/nodesk-mapper.js';
export { NoDeskNormalizer } from './providers/nodesk/nodesk-normalizer.js';

// HN Who Is Hiring Provider
export { createHNHiringProvider, HN_HIRING_PROVIDER_INFO, HN_HIRING_PROVIDER_CAPABILITIES } from './providers/hnhiring/hnhiring-provider.js';
export type { HNHiringProviderConfig } from './providers/hnhiring/hnhiring-provider.js';
export { HNHiringFetcher } from './providers/hnhiring/hnhiring-fetcher.js';
export { HNHiringMapper } from './providers/hnhiring/hnhiring-mapper.js';
export { HNHiringNormalizer } from './providers/hnhiring/hnhiring-normalizer.js';

// Adzuna Provider
export { createAdzunaProvider, ADZUNA_PROVIDER_INFO, ADZUNA_PROVIDER_CAPABILITIES } from './providers/adzuna/adzuna-provider.js';
export type { AdzunaProviderConfig } from './providers/adzuna/adzuna-provider.js';
export { AdzunaFetcher } from './providers/adzuna/adzuna-fetcher.js';
export { AdzunaMapper } from './providers/adzuna/adzuna-mapper.js';
export { AdzunaNormalizer } from './providers/adzuna/adzuna-normalizer.js';

// LinkedIn Provider
export { createLinkedInProvider, LINKEDIN_PROVIDER_INFO, LINKEDIN_PROVIDER_CAPABILITIES } from './providers/linkedin/linkedin-provider.js';
export type { LinkedInProviderConfig } from './providers/linkedin/linkedin-provider.js';
export { LinkedInFetcher } from './providers/linkedin/linkedin-fetcher.js';
export { LinkedInMapper } from './providers/linkedin/linkedin-mapper.js';
export { LinkedInNormalizer } from './providers/linkedin/linkedin-normalizer.js';
export { LinkedInSyncStrategy } from './providers/linkedin/linkedin-sync-strategy.js';
export { validateIngestionPayload, ingestionPayloadToRawJob } from './providers/linkedin/linkedin-ingestion.js';
export type { LinkedInIngestionPayload } from './providers/linkedin/linkedin-types.js';

// SmartRecruiters Provider
export { createSmartRecruitersProvider, SMARTRECRUITERS_PROVIDER_INFO, SMARTRECRUITERS_PROVIDER_CAPABILITIES } from './providers/smartrecruiters/smartrecruiters-provider.js';
export type { SmartRecruitersProviderConfig } from './providers/smartrecruiters/smartrecruiters-provider.js';
export { SmartRecruitersFetcher } from './providers/smartrecruiters/smartrecruiters-fetcher.js';
export { SmartRecruitersMapper } from './providers/smartrecruiters/smartrecruiters-mapper.js';
export { SmartRecruitersNormalizer } from './providers/smartrecruiters/smartrecruiters-normalizer.js';

// Recruitee Provider
export { createRecruiteeProvider, RECRUITEE_PROVIDER_INFO, RECRUITEE_PROVIDER_CAPABILITIES } from './providers/recruitee/recruitee-provider.js';
export type { RecruiteeProviderConfig } from './providers/recruitee/recruitee-provider.js';
export { RecruiteeFetcher } from './providers/recruitee/recruitee-fetcher.js';
export { RecruiteeMapper } from './providers/recruitee/recruitee-mapper.js';
export { RecruiteeNormalizer } from './providers/recruitee/recruitee-normalizer.js';

// Comeet Provider
export { createComeetProvider, COMEET_PROVIDER_INFO, COMEET_PROVIDER_CAPABILITIES } from './providers/comeet/comeet-provider.js';
export type { ComeetProviderConfig } from './providers/comeet/comeet-provider.js';
export { ComeetFetcher } from './providers/comeet/comeet-fetcher.js';
export { ComeetMapper } from './providers/comeet/comeet-mapper.js';
export { ComeetNormalizer } from './providers/comeet/comeet-normalizer.js';

// Habr Career Provider
export { createHabrCareerProvider, HABR_CAREER_PROVIDER_INFO, HABR_CAREER_PROVIDER_CAPABILITIES } from './providers/habr-career/habr-career-provider.js';
export type { HabrCareerProviderConfig } from './providers/habr-career/habr-career-provider.js';
export { HabrCareerFetcher } from './providers/habr-career/habr-career-fetcher.js';
export { HabrCareerMapper } from './providers/habr-career/habr-career-mapper.js';
export { HabrCareerNormalizer } from './providers/habr-career/habr-career-normalizer.js';

// SuperJob Provider
export { createSuperJobProvider, SUPERJOB_PROVIDER_INFO, SUPERJOB_PROVIDER_CAPABILITIES } from './providers/superjob/superjob-provider.js';
export type { SJProviderConfig } from './providers/superjob/superjob-provider.js';
export { SJFetcher } from './providers/superjob/superjob-fetcher.js';
export { SJMapper } from './providers/superjob/superjob-mapper.js';
export { SJNormalizer } from './providers/superjob/superjob-normalizer.js';
export { SJSyncStrategy } from './providers/superjob/superjob-sync-strategy.js';

// Telegram Provider
export { createTelegramProvider, TELEGRAM_PROVIDER_INFO, TELEGRAM_PROVIDER_CAPABILITIES } from './providers/telegram/telegram-provider.js';
export type { TelegramProviderConfig } from './providers/telegram/telegram-provider.js';
export { TelegramFetcher } from './providers/telegram/telegram-fetcher.js';
export { SocialMessageMapper } from './providers/telegram/social-message-mapper.js';
export type { TelegramExtractedFields, TelegramExtractionLookup } from './providers/telegram/social-message-mapper.js';
export { SocialMessageNormalizer } from './providers/telegram/social-message-normalizer.js';
export { TelegramSyncStrategy } from './providers/telegram/telegram-sync-strategy.js';
export type { TelegramRawMessage, TelegramChannelConfig } from './providers/telegram/telegram-types.js';
export { HtmlPreviewTransport } from './providers/telegram/html-preview-transport.js';
export type { HtmlPreviewTransportConfig } from './providers/telegram/html-preview-transport.js';
export { BotApiTransport } from './providers/telegram/bot-api-transport.js';
export type { BotApiTransportConfig, ChannelPostInput } from './providers/telegram/bot-api-transport.js';

// Personio Provider
export {
  createPersonioProvider,
  PERSONIO_PROVIDER_INFO,
  PERSONIO_PROVIDER_CAPABILITIES,
} from './providers/personio/personio-provider.js';
export type { PersonioProviderConfig } from './providers/personio/personio-provider.js';
export { PersonioFetcher } from './providers/personio/personio-fetcher.js';
export { PersonioMapper } from './providers/personio/personio-mapper.js';
export { PersonioNormalizer } from './providers/personio/personio-normalizer.js';

// Workable Provider
export {
  createWorkableProvider,
  WORKABLE_PROVIDER_INFO,
  WORKABLE_PROVIDER_CAPABILITIES,
} from './providers/workable/workable-provider.js';
export type { WorkableProviderConfig } from './providers/workable/workable-provider.js';
export { WorkableFetcher } from './providers/workable/workable-fetcher.js';
export { WorkableMapper } from './providers/workable/workable-mapper.js';
export { WorkableNormalizer } from './providers/workable/workable-normalizer.js';

// PyJobs Provider
export { createPyJobsProvider, PYJOBS_PROVIDER_INFO, PYJOBS_PROVIDER_CAPABILITIES } from './providers/pyjobs/pyjobs-provider.js';
export type { PyJobsProviderConfig } from './providers/pyjobs/pyjobs-provider.js';
export { PyJobsFetcher } from './providers/pyjobs/pyjobs-fetcher.js';
export { PyJobsMapper } from './providers/pyjobs/pyjobs-mapper.js';
export { PyJobsNormalizer } from './providers/pyjobs/pyjobs-normalizer.js';

// Django Jobs Provider
export { createDjangoJobsProvider, DJANGO_JOBS_PROVIDER_INFO, DJANGO_JOBS_PROVIDER_CAPABILITIES } from './providers/djangojobs/djangojobs-provider.js';
export type { DjangoJobsProviderConfig } from './providers/djangojobs/djangojobs-provider.js';
export { DjangoJobsFetcher } from './providers/djangojobs/djangojobs-fetcher.js';
export { DjangoJobsMapper } from './providers/djangojobs/djangojobs-mapper.js';
export { DjangoJobsNormalizer } from './providers/djangojobs/djangojobs-normalizer.js';

// a16z Speedrun Talent Network Provider
export { createSpeedrunProvider, SPEEDRUN_PROVIDER_INFO, SPEEDRUN_PROVIDER_CAPABILITIES } from './providers/speedrun/speedrun-provider.js';
export type { SpeedrunProviderConfig } from './providers/speedrun/speedrun-provider.js';
export { SpeedrunFetcher } from './providers/speedrun/speedrun-fetcher.js';
export { SpeedrunMapper } from './providers/speedrun/speedrun-mapper.js';
export { SpeedrunNormalizer } from './providers/speedrun/speedrun-normalizer.js';

// France Travail Provider
export { createFranceTravailProvider, FRANCE_TRAVAIL_PROVIDER_INFO, FRANCE_TRAVAIL_PROVIDER_CAPABILITIES } from './providers/francetravail/francetravail-provider.js';
export type { FranceTravailProviderConfig } from './providers/francetravail/francetravail-provider.js';
export { FranceTravailFetcher, FRANCE_TRAVAIL_DEFAULT_ROME_CODES } from './providers/francetravail/francetravail-fetcher.js';
export { FranceTravailMapper } from './providers/francetravail/francetravail-mapper.js';
export { FranceTravailNormalizer } from './providers/francetravail/francetravail-normalizer.js';

// Resilience
export { resilientFetch, fetchWithTimeout } from './resilience/resilient-fetch.js';
export type { ResilientFetchConfig } from './resilience/resilient-fetch.js';

// Shared utilities
export { TECH_KEYWORDS, extractTechnologiesFromText } from './shared/tech-keywords.js';
export { decodeHtmlEntities } from './shared/html-entities.js';
export {
  isLikelyJobPost,
  runTelegramPrecheck,
  classifyDeterministicRejection,
} from './shared/message-precheck-classifier.js';
export type {
  PrecheckDecision,
  PrecheckRejection,
  PrecheckRejectionCategory,
} from './shared/message-precheck-classifier.js';

// Testing (fixture-based, no network — for use by consumer test suites and demo scripts)
export { FakeProvider } from './__tests__/fake-provider.js';
export type { FakeProviderBehavior } from './__tests__/fake-provider.js';

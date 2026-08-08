import type { Config } from '@careeros/shared';
import { RedisRateLimiter, getRedis } from '@careeros/shared';
import {
  PrismaVacancyRepository,
  PrismaSearchProfileRepository,
  PrismaResumeRepository,
  PrismaMatchResultRepository,
  PrismaCompanyRepository,
  PrismaApplicationRepository,
  PrismaFollowUpRepository,
  PrismaTelegramConnectionRepository,
  PrismaStructuredResumeRepository,
  PrismaTailoredResumeRepository,
  PrismaAIUsageRepository,
  PrismaAICacheRepository,
  PrismaAICache,
  PrismaCompanyWatchRepository,
  PrismaCompanyWatchEventRepository,
  PrismaCompanyWatchSyncLogRepository,
  PrismaCompanyCandidateRepository,
  PrismaDiscoverySourceRepository,
} from '@careeros/database';
import {
  MatchingEngine,
  VacancyAnalysisPromptBuilder,
  StructuredResumeExtractionPromptBuilder,
  InMemoryAICache,
  InMemoryCostTracker,
  ConsoleAILogger,
  InMemoryAIMetricsCollector,
  InMemoryAITracer,
  createPrimaryAIProviderFromEnv,
  ResumeContextProviderImpl,
  ResumeEvidenceBuilder,
  buildCompactResumeContext,
  estimateTokens,
  VacancyRequirementsPromptBuilder,
  type AIProvider,
  type TailoringPipelineDeps,
  type UsageRecorder,
} from '@careeros/ai';
import { ConsoleLogger, InMemoryMetricsCollector } from '@careeros/providers';
import { TelegramAdapter, InMemoryTelegramClient, type TelegramClient } from '@careeros/telegram';
import { FollowUpReminderService } from '@careeros/notifications';
import {
  AtsAdapterRegistry,
  CompanyWatchService,
  CompanyDiscoveryService,
  CandidateDeduplicationService,
  CompanyDiscoveryIntakeService,
} from '@careeros/company-watch';
import {
  DiscoverySourceRegistry,
  DiscoveryBulkIngestService,
  CommonCrawlAtsDiscoverySource,
  WebDataCommonsJobPostingSource,
  JsonLdCrawlDiscoverySource,
  SitemapDiscoverySource,
  RobotsDiscoverySource,
  RssCareerFeedDiscoverySource,
  GitHubOrgsDiscoverySource,
  CncfLandscapeDiscoverySource,
} from '@careeros/discovery-sources';

export interface WorkerContainer {
  readonly repositories: {
    readonly vacancy: PrismaVacancyRepository;
    readonly searchProfile: PrismaSearchProfileRepository;
    readonly resume: PrismaResumeRepository;
    readonly matchResult: PrismaMatchResultRepository;
    readonly company: PrismaCompanyRepository;
    readonly application: PrismaApplicationRepository;
    readonly followUp: PrismaFollowUpRepository;
    readonly telegramConnection: PrismaTelegramConnectionRepository;
    readonly structuredResume: PrismaStructuredResumeRepository;
    readonly tailoredResume: PrismaTailoredResumeRepository;
  };
  readonly matchingEngine: MatchingEngine;
  readonly followUpReminderService: FollowUpReminderService;
  readonly tailoringPipelineDeps: TailoringPipelineDeps;
  readonly companyWatchRepository: PrismaCompanyWatchRepository;
  readonly companyWatchService: CompanyWatchService;
  readonly discoverySourceConfigRepository: PrismaDiscoverySourceRepository;
  readonly discoveryBulkIngestService: DiscoveryBulkIngestService;
}

// Mirrors apps/backend's createTelegramClient (ADR-016): no separate app can
// import another app's src, so this tiny factory is duplicated rather than
// shared, same as createAIProvider below.
function createTelegramClient(config: Config): TelegramClient {
  if (!config.TELEGRAM_BOT_TOKEN) {
    return new InMemoryTelegramClient();
  }
  return new TelegramAdapter({ botToken: config.TELEGRAM_BOT_TOKEN });
}

// createPrimaryAIProviderFromEnv (packages/ai) is the single source of truth
// for provider-name -> implementation resolution, shared with apps/backend;
// this wrapper only exists because apps can't import another app's src (ADR-016).
export function createAIProvider(config: Config): AIProvider {
  return createPrimaryAIProviderFromEnv(config, {
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    metrics: new InMemoryAIMetricsCollector(),
  });
}

export async function buildWorkerContainer(config: Config): Promise<WorkerContainer> {
  const vacancyRepository = new PrismaVacancyRepository();
  const searchProfileRepository = new PrismaSearchProfileRepository();
  const resumeRepository = new PrismaResumeRepository();
  const matchResultRepository = new PrismaMatchResultRepository();
  const companyRepository = new PrismaCompanyRepository();
  const applicationRepository = new PrismaApplicationRepository();
  const followUpRepository = new PrismaFollowUpRepository();
  const telegramConnectionRepository = new PrismaTelegramConnectionRepository();
  const structuredResumeRepository = new PrismaStructuredResumeRepository();
  const tailoredResumeRepository = new PrismaTailoredResumeRepository();
  const aiCacheRepository = new PrismaAICacheRepository();

  // ADR-035 Phase 0: same construction as apps/backend/src/container.ts's
  // company-watch wiring — apps can't import another app's src (ADR-016), so
  // this small block is duplicated rather than shared.
  const companyWatchRepository = new PrismaCompanyWatchRepository();
  const companyWatchEventRepository = new PrismaCompanyWatchEventRepository();
  const companyWatchSyncLogRepository = new PrismaCompanyWatchSyncLogRepository();
  const atsAdapterRegistry = new AtsAdapterRegistry();
  const companyWatchService = new CompanyWatchService(
    companyWatchRepository,
    companyWatchEventRepository,
    companyWatchSyncLogRepository,
    atsAdapterRegistry
  );

  // ADR-035 Phase 4: bulk DiscoverySource ingestion feeds the same
  // CompanyDiscoveryIntakeService single-shot discovery already uses (ADR
  // §1 — one CompanyCandidate pipeline, not two). Same construction as
  // apps/backend/src/container.ts's Phase 2 wiring, duplicated per ADR-016
  // (apps can't import another app's src).
  const companyCandidateRepository = new PrismaCompanyCandidateRepository();
  const discoveryService = new CompanyDiscoveryService();
  const candidateDeduplicationService = new CandidateDeduplicationService();
  const companyDiscoveryIntakeService = new CompanyDiscoveryIntakeService(
    companyCandidateRepository,
    companyWatchRepository,
    companyWatchService,
    discoveryService,
    atsAdapterRegistry,
    candidateDeduplicationService,
    config.DISCOVERY_WORKSPACE_ID
  );

  const discoverySourceConfigRepository = new PrismaDiscoverySourceRepository();
  const discoverySourceRegistry = new DiscoverySourceRegistry();
  discoverySourceRegistry.register(new CommonCrawlAtsDiscoverySource());
  discoverySourceRegistry.register(new CncfLandscapeDiscoverySource());
  discoverySourceRegistry.register(new SitemapDiscoverySource());
  discoverySourceRegistry.register(new RobotsDiscoverySource());
  discoverySourceRegistry.register(new GitHubOrgsDiscoverySource(splitSeedList(config.DISCOVERY_GITHUB_ORG_SEEDS), config.DISCOVERY_GITHUB_TOKEN));
  discoverySourceRegistry.register(new JsonLdCrawlDiscoverySource(splitSeedList(config.DISCOVERY_JSONLD_SEED_DOMAINS)));
  discoverySourceRegistry.register(new RssCareerFeedDiscoverySource(splitSeedList(config.DISCOVERY_RSS_SEED_DOMAINS)));
  // Structurally complete but not live-verified at bulk scale (see
  // WebDataCommonsJobPostingSource's doc comment) — only registered, and
  // its DiscoverySource config row only ever enabled, once a real subset
  // file URL is provisioned.
  if (config.DISCOVERY_WDC_SOURCE_FILE_URL) {
    discoverySourceRegistry.register(new WebDataCommonsJobPostingSource(config.DISCOVERY_WDC_SOURCE_FILE_URL));
  }

  const discoveryBulkIngestService = new DiscoveryBulkIngestService(
    discoverySourceRegistry,
    discoverySourceConfigRepository,
    companyDiscoveryIntakeService,
    new ConsoleLogger(config.LOG_LEVEL),
    new InMemoryMetricsCollector()
  );

  // Idempotent bootstrap (ADR-035 §16 canary discipline): a registered
  // fetcher gets an enabled config row on first boot; an operator who later
  // disables a specific source via the row directly won't have that
  // overwritten by the next restart (ensureRegistered is a no-op once the
  // row exists).
  for (const fetcher of discoverySourceRegistry.getAll()) {
    await discoverySourceConfigRepository.ensureRegistered(fetcher.id);
  }

  const aiProvider = createAIProvider(config);

  // Same AIUsageRepository the backend dashboard reads from — without this,
  // post-import vacancy matching (which runs here, not in apps/backend) spends
  // real AI provider budget that never shows up in the dashboard, since
  // MatchingEngine's own costTracker below is in-memory and per-process.
  const aiUsageRepository = new PrismaAIUsageRepository();
  const usageRecorder: UsageRecorder = {
    record: async (input) => {
      await aiUsageRepository.create(input);
    },
  };

  const matchingEngine = new MatchingEngine({
    provider: aiProvider,
    promptBuilder: new VacancyAnalysisPromptBuilder(),
    cache: new InMemoryAICache(),
    costTracker: new InMemoryCostTracker(),
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    metrics: new InMemoryAIMetricsCollector(),
    tracer: new InMemoryAITracer(),
    usageRecorder,
  });

  // processDue() also runs from apps/backend (manual/API trigger) — this
  // claim lock (shared Redis key prefix/TTL with that container) keeps the
  // two from ever delivering the same reminder twice if their runs overlap.
  const followUpReminderClaimLock = new RedisRateLimiter(getRedis(config.REDIS_URL), 'follow-up-reminder-claim', 5 * 60_000);
  const followUpReminderService = new FollowUpReminderService(
    followUpRepository,
    applicationRepository,
    telegramConnectionRepository,
    createTelegramClient(config),
    new InMemoryMetricsCollector(),
    new ConsoleLogger(config.LOG_LEVEL),
    followUpReminderClaimLock
  );

  // ADR-031: the resume-tailoring pipeline reuses ResumeContextProvider
  // (structured-or-fallback resolution, ADR-024) wrapped in a
  // ResumeEvidenceBuilder that adapts it to the pipeline's bullet-indexed
  // shape — mirrors how SearchProfileSuggestionService constructs its own
  // ResumeContextProviderImpl in apps/backend (no shared factory exists
  // across apps per ADR-016, so this is constructed here too).
  const resumeContextProvider = new ResumeContextProviderImpl({
    resumeRepository,
    structuredResumeRepository,
    extractionVersion: new StructuredResumeExtractionPromptBuilder().currentVersion,
    fallbackContextBuilder: buildCompactResumeContext,
    tokenEstimator: estimateTokens,
  });
  const resumeEvidenceBuilder = new ResumeEvidenceBuilder(resumeContextProvider);
  // Persistent (DB-backed) rather than InMemoryAICache: PARSING_VACANCY's
  // prompt is resume-independent, so this is what lets N different resumes
  // tailored against the same vacancy across N separate worker jobs (possibly
  // different process instances) share one LLM call instead of paying for it
  // N times — an in-memory, per-process cache wouldn't survive across jobs.
  const tailoringVacancyCache = new PrismaAICache(aiCacheRepository, 'tailor_resume.parsing_vacancy', new VacancyRequirementsPromptBuilder().currentVersion);
  const tailoringPipelineDeps: TailoringPipelineDeps = {
    tailoredResumeRepository,
    resumeEvidenceBuilder,
    provider: aiProvider,
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    usageRecorder,
    cache: tailoringVacancyCache,
  };

  return {
    repositories: {
      vacancy: vacancyRepository,
      searchProfile: searchProfileRepository,
      resume: resumeRepository,
      matchResult: matchResultRepository,
      company: companyRepository,
      application: applicationRepository,
      followUp: followUpRepository,
      telegramConnection: telegramConnectionRepository,
      structuredResume: structuredResumeRepository,
      tailoredResume: tailoredResumeRepository,
    },
    matchingEngine,
    followUpReminderService,
    tailoringPipelineDeps,
    companyWatchRepository,
    companyWatchService,
    discoverySourceConfigRepository,
    discoveryBulkIngestService,
  };
}

function splitSeedList(value: string | undefined): readonly string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

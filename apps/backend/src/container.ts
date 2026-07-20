import type { Config } from '@careeros/shared';
import { RedisAiBatchBacklog, getRedis } from '@careeros/shared';
import {
  PrismaUserRepository,
  PrismaResumeRepository,
  PrismaVacancyRepository,
  PrismaCompanyRepository,
  PrismaApplicationRepository,
  PrismaRecruiterRepository,
  PrismaCommunicationRepository,
  PrismaInterviewRepository,
  PrismaFollowUpRepository,
  PrismaSearchProfileRepository,
  PrismaMatchResultRepository,
  PrismaNotificationHistoryRepository,
  PrismaTelegramConnectionRepository,
  PrismaTelegramLinkingTokenRepository,
  PrismaWorkspaceRepository,
  PrismaRefreshTokenRepository,
  PrismaStructuredResumeRepository,
} from '@careeros/database';
import { createAuthProvider } from '@careeros/auth';
import { ApplicationServiceImpl } from '@careeros/career';
import type { ApplicationService } from '@careeros/career';
import {
  MatchingEngine,
  VacancyAnalysisPromptBuilder,
  SearchProfileSuggestionPromptBuilder,
  StructuredResumeExtractionPromptBuilder,
  ResumeExtractionEngine,
  InMemoryAICache,
  InMemoryCostTracker,
  ConsoleAILogger,
  InMemoryAIMetricsCollector,
  InMemoryAITracer,
  createAIProviderFromConfig,
  createPrimaryAIProviderFromEnv,
  AIProviderHealthMonitor,
} from '@careeros/ai';
import type { AIProvider } from '@careeros/ai';
import {
  ProviderRegistry,
  createRemoteOKProvider,
  createHHProvider,
  createGreenhouseProvider,
  createLeverProvider,
  createAshbyProvider,
  createWorkdayProvider,
  createTeamtailorProvider,
  ConsoleLogger as ProviderConsoleLogger,
  InMemoryMetricsCollector as ProviderInMemoryMetricsCollector,
  InMemoryTracer as ProviderInMemoryTracer,
  ProviderHealthMonitor,
} from '@careeros/providers';
import type { Logger as ProviderLogger } from '@careeros/providers';
import { TelegramAdapter, InMemoryTelegramClient } from '@careeros/telegram';
import type { TelegramClient } from '@careeros/telegram';
import { FollowUpReminderService } from '@careeros/notifications';
import { SearchProfileService } from './services/search-profile-service.js';
import { ProviderSearchService } from './services/provider-search-service.js';
import { AiMatchingService } from './services/ai-matching-service.js';
import { RecommendationService } from './services/recommendation-service.js';
import { ApplicationCreationService } from './services/application-creation-service.js';
import { ApplicationCrmService } from './services/application-crm-service.js';
import { FollowUpService } from './services/follow-up-service.js';
import { RecruiterService } from './services/recruiter-service.js';
import { IntelligenceWorkflowService } from './services/intelligence-workflow-service.js';
import { MorningDigestService } from './services/morning-digest-service.js';
import { DigestBuilder } from './services/digest-builder.js';
import { TelegramDigestFormatter } from './services/telegram-digest-formatter.js';
import { DigestDeliveryService } from './services/digest-delivery-service.js';
import { ManualDigestScheduler } from './services/digest-scheduler.js';
import { TelegramLinkingService } from './services/telegram-linking-service.js';
import { AuthService } from './services/auth-service.js';
import { ResumeService } from './services/resume-service.js';
import { SearchProfileSuggestionService } from './services/search-profile-suggestion-service.js';
import { BullMqVacancyAnalysisQueue, type VacancyAnalysisQueue } from './queues/vacancy-analysis-queue.js';
import { ProviderDiagnosticsService, type ProviderRegistrationOutcome } from './services/provider-diagnostics-service.js';
import { SearchRunTraceRecorder } from './services/search-run-trace.js';
import { QueueDiagnosticsService } from './services/queue-diagnostics-service.js';

export interface Container {
  readonly repositories: {
    readonly user: PrismaUserRepository;
    readonly resume: PrismaResumeRepository;
    readonly vacancy: PrismaVacancyRepository;
    readonly company: PrismaCompanyRepository;
    readonly application: PrismaApplicationRepository;
    readonly recruiter: PrismaRecruiterRepository;
    readonly communication: PrismaCommunicationRepository;
    readonly interview: PrismaInterviewRepository;
    readonly followUp: PrismaFollowUpRepository;
    readonly searchProfile: PrismaSearchProfileRepository;
    readonly matchResult: PrismaMatchResultRepository;
    readonly notificationHistory: PrismaNotificationHistoryRepository;
    readonly telegramConnection: PrismaTelegramConnectionRepository;
    readonly telegramLinkingToken: PrismaTelegramLinkingTokenRepository;
    readonly workspace: PrismaWorkspaceRepository;
    readonly refreshToken: PrismaRefreshTokenRepository;
    readonly structuredResume: PrismaStructuredResumeRepository;
  };
  readonly authProvider: ReturnType<typeof createAuthProvider>;
  readonly providerRegistry: ProviderRegistry;
  readonly providerHealthMonitor: ProviderHealthMonitor;
  readonly providerDiagnostics: ProviderDiagnosticsService;
  readonly searchRunTraces: SearchRunTraceRecorder;
  readonly queueDiagnostics: QueueDiagnosticsService;
  readonly aiProvider: AIProvider;
  readonly aiProviderHealthMonitor: AIProviderHealthMonitor;
  readonly aiMetrics: InMemoryAIMetricsCollector;
  readonly applicationService: ApplicationService;
  readonly services: {
    readonly auth: AuthService;
    readonly searchProfile: SearchProfileService;
    readonly providerSearch: ProviderSearchService;
    readonly aiMatching: AiMatchingService;
    readonly recommendation: RecommendationService;
    readonly applicationCreation: ApplicationCreationService;
    readonly applicationCrm: ApplicationCrmService;
    readonly followUp: FollowUpService;
    readonly followUpReminder: FollowUpReminderService;
    readonly recruiter: RecruiterService;
    readonly intelligenceWorkflow: IntelligenceWorkflowService;
    readonly morningDigest: MorningDigestService;
    readonly digestDelivery: DigestDeliveryService;
    readonly digestScheduler: ManualDigestScheduler;
    readonly telegramLinking: TelegramLinkingService;
    readonly resume: ResumeService;
    readonly searchProfileSuggestion: SearchProfileSuggestionService;
  };
}

/**
 * Registers every job provider whose required identifiers are present in
 * config. Each of Greenhouse/Lever/Ashby/Workday/Teamtailor is board- or
 * tenant-scoped (there's no universal endpoint), so a provider with missing
 * config is skipped with a warning rather than failing backend startup.
 *
 * Returns one ProviderRegistrationOutcome per *known* provider — including
 * the ones that were skipped — so ProviderDiagnosticsService never has to
 * treat an unconfigured provider as silently invisible.
 */
function registerConfiguredProviders(
  registry: ProviderRegistry,
  config: Config,
  logger: ProviderLogger
): ProviderRegistrationOutcome[] {
  const outcomes: ProviderRegistrationOutcome[] = [];

  registry.register(
    createRemoteOKProvider({
      logger,
      metrics: new ProviderInMemoryMetricsCollector(),
      tracer: new ProviderInMemoryTracer(),
    })
  );
  outcomes.push({ providerId: 'remote_ok', registered: true, configured: true, authenticated: 'not_required' });

  // HH (HeadHunter) requires no API key for search — an access token only
  // raises rate limits, so it's registered unconditionally, same as RemoteOK.
  registry.register(
    createHHProvider({
      accessToken: config.HH_ACCESS_TOKEN,
      logger,
      metrics: new ProviderInMemoryMetricsCollector(),
      tracer: new ProviderInMemoryTracer(),
    })
  );
  outcomes.push({
    providerId: 'hh',
    registered: true,
    configured: true,
    authenticated: config.HH_ACCESS_TOKEN ? 'configured' : 'not_required',
  });

  if (config.GREENHOUSE_BOARD_TOKEN && config.GREENHOUSE_COMPANY_NAME) {
    registry.register(
      createGreenhouseProvider({
        boardToken: config.GREENHOUSE_BOARD_TOKEN,
        companyName: config.GREENHOUSE_COMPANY_NAME,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'greenhouse', registered: true, configured: true, authenticated: 'configured' });
  } else {
    const reason = 'GREENHOUSE_BOARD_TOKEN/GREENHOUSE_COMPANY_NAME not set';
    logger.warn(`Greenhouse provider not registered: ${reason}`);
    outcomes.push({ providerId: 'greenhouse', registered: false, configured: false, authenticated: 'missing', reason });
  }

  if (config.LEVER_COMPANY && config.LEVER_COMPANY_NAME) {
    registry.register(
      createLeverProvider({
        company: config.LEVER_COMPANY,
        companyName: config.LEVER_COMPANY_NAME,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'lever', registered: true, configured: true, authenticated: 'not_required' });
  } else {
    const reason = 'LEVER_COMPANY/LEVER_COMPANY_NAME not set';
    logger.warn(`Lever provider not registered: ${reason}`);
    outcomes.push({ providerId: 'lever', registered: false, configured: false, authenticated: 'missing', reason });
  }

  if (config.ASHBY_JOB_BOARD_NAME && config.ASHBY_COMPANY_NAME) {
    registry.register(
      createAshbyProvider({
        jobBoardName: config.ASHBY_JOB_BOARD_NAME,
        companyName: config.ASHBY_COMPANY_NAME,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'ashby', registered: true, configured: true, authenticated: 'not_required' });
  } else {
    const reason = 'ASHBY_JOB_BOARD_NAME/ASHBY_COMPANY_NAME not set';
    logger.warn(`Ashby provider not registered: ${reason}`);
    outcomes.push({ providerId: 'ashby', registered: false, configured: false, authenticated: 'missing', reason });
  }

  if (config.WORKDAY_TENANT && config.WORKDAY_SITE && config.WORKDAY_COMPANY_NAME) {
    registry.register(
      createWorkdayProvider({
        tenant: config.WORKDAY_TENANT,
        site: config.WORKDAY_SITE,
        companyName: config.WORKDAY_COMPANY_NAME,
        host: config.WORKDAY_HOST,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'workday', registered: true, configured: true, authenticated: 'not_required' });
  } else {
    const reason = 'WORKDAY_TENANT/WORKDAY_SITE/WORKDAY_COMPANY_NAME not set';
    logger.warn(`Workday provider not registered: ${reason}`);
    outcomes.push({ providerId: 'workday', registered: false, configured: false, authenticated: 'missing', reason });
  }

  if (config.TEAMTAILOR_API_KEY && config.TEAMTAILOR_COMPANY_NAME) {
    registry.register(
      createTeamtailorProvider({
        apiKey: config.TEAMTAILOR_API_KEY,
        companyName: config.TEAMTAILOR_COMPANY_NAME,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'teamtailor', registered: true, configured: true, authenticated: 'configured' });
  } else {
    const reason = 'TEAMTAILOR_API_KEY/TEAMTAILOR_COMPANY_NAME not set';
    logger.warn(`Teamtailor provider not registered: ${reason}`);
    outcomes.push({ providerId: 'teamtailor', registered: false, configured: false, authenticated: 'missing', reason });
  }

  return outcomes;
}

function createTelegramClient(config: Config): TelegramClient {
  if (!config.TELEGRAM_BOT_TOKEN) {
    return new InMemoryTelegramClient();
  }
  return new TelegramAdapter({ botToken: config.TELEGRAM_BOT_TOKEN });
}

// createPrimaryAIProviderFromEnv (packages/ai) is the single source of truth
// for provider-name -> implementation resolution, shared with apps/worker;
// this wrapper only exists because apps can't import another app's src (ADR-016).
// The health monitor is passed in (rather than left to FallbackAIProvider's
// own default) so the diagnostics routes can read the exact same instance
// FallbackAIProvider records successes/failures against, instead of a
// separate, out-of-sync health tracker.
export function createAIProvider(config: Config, healthMonitor: AIProviderHealthMonitor): AIProvider {
  return createPrimaryAIProviderFromEnv(config, {
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    metrics: new InMemoryAIMetricsCollector(),
    healthMonitor,
  });
}

/**
 * Provider used for low-stakes suggestions (e.g. search profile suggestion).
 * On Groq this pins a smaller/cheaper model (GROQ_SUGGESTION_MODEL) so it
 * doesn't share the same rate-limit budget as vacancy matching's model.
 * Other providers have no separate suggestion model, so they reuse `aiProvider`.
 */
export function createSuggestionAIProvider(config: Config, aiProvider: AIProvider): AIProvider {
  if (config.AI_PROVIDER === 'groq') {
    return createAIProviderFromConfig({
      provider: 'groq',
      config: { apiKey: config.GROQ_API_KEY ?? '', model: config.GROQ_SUGGESTION_MODEL },
    });
  }
  return aiProvider;
}

export function buildContainer(config: Config): Container {
  const userRepository = new PrismaUserRepository();
  const resumeRepository = new PrismaResumeRepository();
  const vacancyRepository = new PrismaVacancyRepository();
  const companyRepository = new PrismaCompanyRepository();
  const applicationRepository = new PrismaApplicationRepository();
  const recruiterRepository = new PrismaRecruiterRepository();
  const communicationRepository = new PrismaCommunicationRepository();
  const interviewRepository = new PrismaInterviewRepository();
  const followUpRepository = new PrismaFollowUpRepository();
  const searchProfileRepository = new PrismaSearchProfileRepository();
  const matchResultRepository = new PrismaMatchResultRepository();
  const notificationHistoryRepository = new PrismaNotificationHistoryRepository();
  const telegramConnectionRepository = new PrismaTelegramConnectionRepository();
  const telegramLinkingTokenRepository = new PrismaTelegramLinkingTokenRepository();
  const workspaceRepository = new PrismaWorkspaceRepository();
  const refreshTokenRepository = new PrismaRefreshTokenRepository();
  const structuredResumeRepository = new PrismaStructuredResumeRepository();

  const authProvider = createAuthProvider({
    jwtSecret: config.JWT_SECRET,
    jwtAccessExpiresIn: config.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
    argon2MemoryCost: config.ARGON2_MEMORY_COST,
    argon2TimeCost: config.ARGON2_TIME_COST,
    argon2Parallelism: config.ARGON2_PARALLELISM,
  });

  const providerRegistry = new ProviderRegistry();
  const registrationOutcomes = registerConfiguredProviders(
    providerRegistry,
    config,
    new ProviderConsoleLogger(config.LOG_LEVEL)
  );

  const providerHealthMonitor = new ProviderHealthMonitor({
    checkIntervalMs: 5 * 60 * 1000,
    unhealthyThreshold: 3,
    degradedThresholdMs: 3000,
    healthyThresholdMs: 1000,
  });
  const providerDiagnosticsService = new ProviderDiagnosticsService(providerHealthMonitor);
  providerDiagnosticsService.recordRegistrations(registrationOutcomes);
  const searchRunTraceRecorder = new SearchRunTraceRecorder();
  const queueDiagnosticsService = new QueueDiagnosticsService(config.REDIS_URL);

  const aiProviderHealthMonitor = new AIProviderHealthMonitor();
  const aiProvider = createAIProvider(config, aiProviderHealthMonitor);
  const suggestionAIProvider = createSuggestionAIProvider(config, aiProvider);

  const matchingEngine = new MatchingEngine({
    provider: aiProvider,
    promptBuilder: new VacancyAnalysisPromptBuilder(),
    cache: new InMemoryAICache(),
    costTracker: new InMemoryCostTracker(),
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    metrics: new InMemoryAIMetricsCollector(),
    tracer: new InMemoryAITracer(),
  });

  const aiMetrics = new InMemoryAIMetricsCollector();
  const applicationService = new ApplicationServiceImpl(applicationRepository);

  const searchProfileService = new SearchProfileService(searchProfileRepository);
  const providerSearchService = new ProviderSearchService(
    providerRegistry,
    vacancyRepository,
    companyRepository,
    new ProviderConsoleLogger(config.LOG_LEVEL),
    new ProviderInMemoryMetricsCollector(),
    config.PROVIDER_TIMEOUT_MS,
    config.PROVIDER_SEARCH_LIMIT,
    config.MIN_RELEVANCE_SCORE,
    providerDiagnosticsService
  );
  const aiMatchingService = new AiMatchingService(
    matchingEngine,
    matchResultRepository,
    companyRepository,
    aiMetrics,
    // Groq's free-tier TPM budget can't absorb several ~6-7k token match
    // prompts fired concurrently, so serialize matching for it instead of
    // fanning out at the configured concurrency.
    config.AI_PROVIDER === 'groq' ? 1 : config.AI_MATCHING_CONCURRENCY,
    config.AI_MAX_CANDIDATES,
    new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info')
  );
  const recommendationService = new RecommendationService(aiMetrics);
  const applicationCreationService = new ApplicationCreationService(applicationService);
  const followUpService = new FollowUpService(
    followUpRepository,
    applicationRepository,
    vacancyRepository,
    companyRepository
  );
  const applicationCrmService = new ApplicationCrmService(
    applicationService,
    applicationRepository,
    recruiterRepository,
    communicationRepository,
    interviewRepository,
    followUpService
  );
  const recruiterService = new RecruiterService(recruiterRepository);
  const vacancyAnalysisQueue: VacancyAnalysisQueue = new BullMqVacancyAnalysisQueue(config.REDIS_URL);
  const intelligenceWorkflowService = new IntelligenceWorkflowService(
    searchProfileService,
    providerSearchService,
    aiMatchingService,
    recommendationService,
    resumeRepository,
    userRepository,
    vacancyRepository,
    vacancyAnalysisQueue,
    new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    config.AI_ENABLED,
    new RedisAiBatchBacklog(getRedis(config.REDIS_URL)),
    searchRunTraceRecorder
  );

  const digestMetrics = new ProviderInMemoryMetricsCollector();
  const telegramClient = createTelegramClient(config);
  const morningDigestService = new MorningDigestService(
    intelligenceWorkflowService,
    notificationHistoryRepository,
    companyRepository,
    new DigestBuilder(),
    digestMetrics
  );
  const digestDeliveryService = new DigestDeliveryService(
    morningDigestService,
    new TelegramDigestFormatter(),
    telegramClient,
    telegramConnectionRepository,
    notificationHistoryRepository,
    digestMetrics,
    new ProviderConsoleLogger(config.LOG_LEVEL)
  );
  const digestScheduler = new ManualDigestScheduler(digestDeliveryService);
  const followUpReminderService = new FollowUpReminderService(
    followUpRepository,
    applicationRepository,
    telegramConnectionRepository,
    telegramClient,
    digestMetrics,
    new ProviderConsoleLogger(config.LOG_LEVEL)
  );
  const telegramLinkingService = new TelegramLinkingService(
    userRepository,
    telegramConnectionRepository,
    telegramLinkingTokenRepository,
    digestMetrics,
    new ProviderConsoleLogger(config.LOG_LEVEL)
  );

  const authService = new AuthService(
    authProvider,
    userRepository,
    workspaceRepository,
    refreshTokenRepository
  );

  const resumeService = new ResumeService(resumeRepository);

  const extractionEngine = new ResumeExtractionEngine(
    {
      provider: aiProvider,
      promptBuilder: new StructuredResumeExtractionPromptBuilder(),
      logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
      metrics: new InMemoryAIMetricsCollector(),
    },
    { maxRetries: 2, timeoutMs: 60_000 }
  );

  const searchProfileSuggestionService = new SearchProfileSuggestionService(
    resumeRepository,
    suggestionAIProvider,
    structuredResumeRepository,
    extractionEngine,
    '1.0.0',
    new SearchProfileSuggestionPromptBuilder()
  );

  return {
    repositories: {
      user: userRepository,
      resume: resumeRepository,
      vacancy: vacancyRepository,
      company: companyRepository,
      application: applicationRepository,
      recruiter: recruiterRepository,
      communication: communicationRepository,
      interview: interviewRepository,
      followUp: followUpRepository,
      searchProfile: searchProfileRepository,
      matchResult: matchResultRepository,
      notificationHistory: notificationHistoryRepository,
      telegramConnection: telegramConnectionRepository,
      telegramLinkingToken: telegramLinkingTokenRepository,
      workspace: workspaceRepository,
      refreshToken: refreshTokenRepository,
      structuredResume: structuredResumeRepository,
    },
    authProvider,
    providerRegistry,
    providerHealthMonitor,
    providerDiagnostics: providerDiagnosticsService,
    searchRunTraces: searchRunTraceRecorder,
    queueDiagnostics: queueDiagnosticsService,
    aiProvider,
    aiProviderHealthMonitor,
    aiMetrics,
    applicationService,
    services: {
      auth: authService,
      searchProfile: searchProfileService,
      providerSearch: providerSearchService,
      aiMatching: aiMatchingService,
      recommendation: recommendationService,
      applicationCreation: applicationCreationService,
      applicationCrm: applicationCrmService,
      followUp: followUpService,
      followUpReminder: followUpReminderService,
      recruiter: recruiterService,
      intelligenceWorkflow: intelligenceWorkflowService,
      morningDigest: morningDigestService,
      digestDelivery: digestDeliveryService,
      digestScheduler,
      telegramLinking: telegramLinkingService,
      resume: resumeService,
      searchProfileSuggestion: searchProfileSuggestionService,
    },
  };
}

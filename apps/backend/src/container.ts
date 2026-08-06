import type { Config } from '@careeros/shared';
import { RedisAiBatchBacklog, getRedis, parseTelegramChannelList } from '@careeros/shared';
import {
  PrismaUserRepository,
  PrismaResumeRepository,
  PrismaVacancyRepository,
  PrismaVacancySourceRepository,
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
  PrismaCompanyWatchRepository,
  PrismaCompanyWatchEventRepository,
  PrismaCompanyWatchSyncLogRepository,
  PrismaCompanyCandidateRepository,
  PrismaAIJobRepository,
  PrismaAICacheRepository,
  PrismaAIUsageRepository,
  PrismaAIProviderConfigRepository,
  PrismaAIBudgetRepository,
  PrismaAnalyticsEventRepository,
  PrismaCareerInsightRepository,
  PrismaProviderConfigRepository,
  PrismaTelegramChannelRepository,
  PrismaTelegramChannelStatsRepository,
  PrismaQualityDataRepository,
  PrismaUserVacancyInteractionRepository,
  PrismaTailoredResumeRepository,
  PrismaSocialMessageRepository,
  PrismaMessageExtractionRepository,
} from '@careeros/database';
import { createAuthProvider } from '@careeros/auth';
import { ApplicationServiceImpl, SocialPlatform } from '@careeros/career';
import type { ApplicationService } from '@careeros/career';
import {
  AIOrchestrator,
  AnalyzeVacancyHandler,
  CoverLetterHandler,
  InterviewPrepHandler,
  SalaryAnalysisHandler,
  CompanyAnalysisHandler,
  ResumeImprovementHandler,
  CareerAdviceHandler,
  BudgetEnforcer,
  UsageTracker,
} from '@careeros/ai-orchestrator';
import type { AIFeature, JobHandler } from '@careeros/ai-orchestrator';
import {
  MatchingEngine,
  VacancyAnalysisPromptBuilder,
  SearchProfileSuggestionPromptBuilder,
  StructuredResumeExtractionPromptBuilder,
  ResumeExtractionEngine,
  MessageExtractionEngine,
  MessageExtractionStatus,
  MESSAGE_EXTRACTION_DISCOVERY_MIN_CONFIDENCE,
  MessageExtractionPromptBuilder,
  InMemoryAICache,
  InMemoryCostTracker,
  ConsoleAILogger,
  InMemoryAIMetricsCollector,
  InMemoryAITracer,
  createAIProviderFromConfig,
  createPrimaryAIProviderFromEnv,
  AIProviderHealthMonitor,
} from '@careeros/ai';
import type { AIProvider, UsageRecorder, MessageExtraction } from '@careeros/ai';
import {
  ProviderRegistry,
  createHHProvider,
  createGreenhouseProvider,
  createLeverProvider,
  createAshbyProvider,
  createWorkdayProvider,
  createTeamtailorProvider,
  createRemotiveProvider,
  createArbeitnowProvider,
  createJobicyProvider,
  createWWRProvider,
  createWorkingNomadsProvider,
  createNoDeskProvider,
  createPyJobsProvider,
  createDjangoJobsProvider,
  createSpeedrunProvider,
  createFranceTravailProvider,
  createHNHiringProvider,
  createLinkedInProvider,
  createAdzunaProvider,
  createSmartRecruitersProvider,
  createRecruiteeProvider,
  createComeetProvider,
  createPersonioProvider,
  createWorkableProvider,
  createHabrCareerProvider,
  createSuperJobProvider,
  createTelegramProvider,
  ConsoleLogger as ProviderConsoleLogger,
  InMemoryMetricsCollector as ProviderInMemoryMetricsCollector,
  InMemoryTracer as ProviderInMemoryTracer,
  ProviderHealthMonitor,
  SocialMessageTransportRegistry,
  TransportManager,
  TelegramFetcher,
  HtmlPreviewTransport,
  BotApiTransport,
} from '@careeros/providers';
import type { Logger as ProviderLogger, TelegramExtractionLookup, TelegramExtractedFields, NormalizedVacancy } from '@careeros/providers';
import { TelegramAdapter, InMemoryTelegramClient } from '@careeros/telegram';
import type { TelegramClient } from '@careeros/telegram';
import { FollowUpReminderService } from '@careeros/notifications';
import {
  CompanyWatchService,
  AtsAdapterRegistry,
  CompanyDiscoveryService,
  CandidateDeduplicationService,
  CompanyDiscoveryIntakeService,
  VacancyDiscoveryBridge,
} from '@careeros/company-watch';
import type { VacancyForDiscovery } from '@careeros/company-watch';
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
import { WorkspaceService } from './services/workspace-service.js';
import { ResumeService } from './services/resume-service.js';
import { SearchProfileSuggestionService } from './services/search-profile-suggestion-service.js';
import { SyncSchedulerService } from './services/sync-scheduler-service.js';
import { SocialMessageIngestionService } from './services/social-message-ingestion-service.js';
import { SocialMessagePipeline } from './services/social-message-pipeline.js';
import { TelegramChannelStatsService } from './services/telegram-channel-stats-service.js';
import { RedisRateLimiter } from './services/redis-rate-limiter.js';
import { DashboardStatsService } from './services/dashboard-stats-service.js';
import { NotificationDispatcherService } from './services/notification-dispatcher-service.js';
import { BullMqVacancyAnalysisQueue, type VacancyAnalysisQueue } from './queues/vacancy-analysis-queue.js';
import { BullMqResumeTailoringQueue, type ResumeTailoringQueue } from './queues/resume-tailoring-queue.js';
import { TailoringRequestService } from './services/tailoring-request-service.js';
import { ProviderDiagnosticsService, type ProviderRegistrationOutcome } from './services/provider-diagnostics-service.js';
import { CompanyDiscoveryDiagnosticsService } from './services/company-discovery-diagnostics-service.js';
import { SearchRunTraceRecorder } from './services/search-run-trace.js';
import { QueueDiagnosticsService } from './services/queue-diagnostics-service.js';
import { CareerIntelligenceService } from './services/career-intelligence-service.js';
import { ResumeVersionIntelligenceService } from './services/resume-version-intelligence-service.js';
import { ProviderManagementService } from './services/provider-management-service.js';

export interface Container {
  readonly repositories: {
    readonly user: PrismaUserRepository;
    readonly resume: PrismaResumeRepository;
    readonly vacancy: PrismaVacancyRepository;
    readonly vacancySource: PrismaVacancySourceRepository;
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
    readonly tailoredResume: PrismaTailoredResumeRepository;
    readonly aiJob: PrismaAIJobRepository;
    readonly aiCache: PrismaAICacheRepository;
    readonly aiUsage: PrismaAIUsageRepository;
    readonly aiProviderConfig: PrismaAIProviderConfigRepository;
    readonly aiBudget: PrismaAIBudgetRepository;
    readonly analyticsEvent: PrismaAnalyticsEventRepository;
    readonly careerInsight: PrismaCareerInsightRepository;
    readonly providerConfig: PrismaProviderConfigRepository;
    readonly telegramChannel: PrismaTelegramChannelRepository;
    readonly userVacancyInteraction: PrismaUserVacancyInteractionRepository;
    readonly socialMessage: PrismaSocialMessageRepository;
    readonly messageExtraction: PrismaMessageExtractionRepository;
    readonly companyCandidate: PrismaCompanyCandidateRepository;
  };
  readonly authProvider: ReturnType<typeof createAuthProvider>;
  readonly providerRegistry: ProviderRegistry;
  readonly providerHealthMonitor: ProviderHealthMonitor;
  readonly socialMessageTransportRegistry: SocialMessageTransportRegistry;
  readonly transportManager: TransportManager;
  readonly botApiTransport: BotApiTransport;
  readonly providerDiagnostics: ProviderDiagnosticsService;
  readonly companyDiscoveryDiagnostics: CompanyDiscoveryDiagnosticsService;
  readonly searchRunTraces: SearchRunTraceRecorder;
  readonly queueDiagnostics: QueueDiagnosticsService;
  readonly aiProvider: AIProvider;
  readonly aiProviderHealthMonitor: AIProviderHealthMonitor;
  readonly aiMetrics: InMemoryAIMetricsCollector;
  readonly aiOrchestrator: AIOrchestrator;
  /**
   * ADR-032 Phase 3: SocialMessage -> MessageExtraction. Driven by
   * `services.socialMessagePipeline` (Phase 4/5), wired from the same
   * onProviderSynced('telegram') hook SocialMessageIngestionService uses.
   */
  readonly messageExtractionEngine: MessageExtractionEngine;
  readonly applicationService: ApplicationService;
  readonly services: {
    readonly auth: AuthService;
    readonly workspace: WorkspaceService;
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
    readonly syncScheduler: SyncSchedulerService;
    readonly syncRateLimiter: RedisRateLimiter;
    readonly dashboardStats: DashboardStatsService;
    readonly notificationDispatcher: NotificationDispatcherService;
    readonly companyWatch: CompanyWatchService;
    readonly companyDiscoveryIntake: CompanyDiscoveryIntakeService;
    readonly careerIntelligence: CareerIntelligenceService;
    readonly resumeVersionIntelligence: ResumeVersionIntelligenceService;
    readonly providerManagement: ProviderManagementService;
    readonly tailoringRequest: TailoringRequestService;
    readonly socialMessageIngestion: SocialMessageIngestionService;
    readonly socialMessagePipeline: SocialMessagePipeline;
    readonly telegramChannelStats: TelegramChannelStatsService;
  };
}

/**
 * Priority: DB enabled channels > ENV fallback for migration compatibility.
 * Shared by V1's createTelegramProvider() registration below and by
 * registerSocialMessageTransports() (V2 transport layer) so both read the
 * exact same channel list instead of two independently-parsed copies.
 */
function resolveTelegramChannelSource(
  config: Config,
  telegramChannelRepo?: PrismaTelegramChannelRepository,
): { envChannelsList: readonly string[]; channelProvider?: () => Promise<readonly string[]> } {
  const envChannelsList = parseTelegramChannelList(config.TELEGRAM_CHANNELS);

  const channelProvider = telegramChannelRepo
    ? async (): Promise<readonly string[]> => {
        try {
          const dbChannels = await telegramChannelRepo.findEnabledUsernames();
          if (dbChannels.length > 0) return dbChannels;
        } catch {
          // DB not available, fall through to ENV
        }
        return envChannelsList;
      }
    : undefined;

  return { envChannelsList, channelProvider };
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
  logger: ProviderLogger,
  telegramChannelRepo?: PrismaTelegramChannelRepository,
  transportManager?: TransportManager,
  extractionLookup?: TelegramExtractionLookup,
): ProviderRegistrationOutcome[] {
  const outcomes: ProviderRegistrationOutcome[] = [];

  // HH (HeadHunter) requires no API key for search — an access token only
  // raises rate limits, so it's registered unconditionally.
  // All HH group domains (hh.ru, hh.kz, headhunter.ge) use api.hh.ru.
  // rabota.by has NO API — Belarus jobs are accessed via area ID 16.
  registry.register(
    createHHProvider({
      accessToken: config.HH_ACCESS_TOKEN,
      areas: config.HH_AREAS.split(',').map((area) => area.trim()).filter(Boolean),
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

  // Adzuna — requires app_id and app_key from https://developer.adzuna.com
  const adzunaRequiredConfig = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY'];
  if (config.ADZUNA_APP_ID && config.ADZUNA_APP_KEY) {
    registry.register(
      createAdzunaProvider({
        appId: config.ADZUNA_APP_ID,
        appKey: config.ADZUNA_APP_KEY,
        country: config.ADZUNA_COUNTRY,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'adzuna', registered: true, configured: true, authenticated: 'configured', requiredConfig: adzunaRequiredConfig });
  } else {
    const reason = 'ADZUNA_APP_ID/ADZUNA_APP_KEY not set';
    logger.warn(`Adzuna provider not registered: ${reason}`);
    outcomes.push({ providerId: 'adzuna', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: adzunaRequiredConfig });
  }

  // France Travail — requires OAuth2 client_credentials from a free
  // francetravail.io developer registration (see research/free-provider-expansion).
  const franceTravailRequiredConfig = ['FRANCE_TRAVAIL_CLIENT_ID', 'FRANCE_TRAVAIL_CLIENT_SECRET'];
  if (config.FRANCE_TRAVAIL_CLIENT_ID && config.FRANCE_TRAVAIL_CLIENT_SECRET) {
    registry.register(
      createFranceTravailProvider({
        clientId: config.FRANCE_TRAVAIL_CLIENT_ID,
        clientSecret: config.FRANCE_TRAVAIL_CLIENT_SECRET,
        romeCodes: config.FRANCE_TRAVAIL_ROME_CODES?.split(',').map((c) => c.trim()).filter(Boolean),
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'france_travail', registered: true, configured: true, authenticated: 'configured', requiredConfig: franceTravailRequiredConfig });
  } else {
    const reason = 'FRANCE_TRAVAIL_CLIENT_ID/FRANCE_TRAVAIL_CLIENT_SECRET not set';
    logger.warn(`France Travail provider not registered: ${reason}`);
    outcomes.push({ providerId: 'france_travail', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: franceTravailRequiredConfig });
  }

  const greenhouseRequiredConfig = ['GREENHOUSE_BOARD_TOKEN', 'GREENHOUSE_COMPANY_NAME'];
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
    outcomes.push({ providerId: 'greenhouse', registered: true, configured: true, authenticated: 'configured', requiredConfig: greenhouseRequiredConfig });
  } else {
    const reason = 'GREENHOUSE_BOARD_TOKEN/GREENHOUSE_COMPANY_NAME not set';
    logger.warn(`Greenhouse provider not registered: ${reason}`);
    outcomes.push({ providerId: 'greenhouse', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: greenhouseRequiredConfig });
  }

  const leverRequiredConfig = ['LEVER_COMPANY', 'LEVER_COMPANY_NAME'];
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
    outcomes.push({ providerId: 'lever', registered: true, configured: true, authenticated: 'not_required', requiredConfig: leverRequiredConfig });
  } else {
    const reason = 'LEVER_COMPANY/LEVER_COMPANY_NAME not set';
    logger.warn(`Lever provider not registered: ${reason}`);
    outcomes.push({ providerId: 'lever', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: leverRequiredConfig });
  }

  const ashbyRequiredConfig = ['ASHBY_JOB_BOARD_NAME', 'ASHBY_COMPANY_NAME'];
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
    outcomes.push({ providerId: 'ashby', registered: true, configured: true, authenticated: 'not_required', requiredConfig: ashbyRequiredConfig });
  } else {
    const reason = 'ASHBY_JOB_BOARD_NAME/ASHBY_COMPANY_NAME not set';
    logger.warn(`Ashby provider not registered: ${reason}`);
    outcomes.push({ providerId: 'ashby', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: ashbyRequiredConfig });
  }

  const workdayRequiredConfig = ['WORKDAY_TENANT', 'WORKDAY_SITE', 'WORKDAY_COMPANY_NAME'];
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
    outcomes.push({ providerId: 'workday', registered: true, configured: true, authenticated: 'not_required', requiredConfig: workdayRequiredConfig });
  } else {
    const reason = 'WORKDAY_TENANT/WORKDAY_SITE/WORKDAY_COMPANY_NAME not set';
    logger.warn(`Workday provider not registered: ${reason}`);
    outcomes.push({ providerId: 'workday', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: workdayRequiredConfig });
  }

  const teamtailorRequiredConfig = ['TEAMTAILOR_API_KEY', 'TEAMTAILOR_COMPANY_NAME'];
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
    outcomes.push({ providerId: 'teamtailor', registered: true, configured: true, authenticated: 'configured', requiredConfig: teamtailorRequiredConfig });
  } else {
    const reason = 'TEAMTAILOR_API_KEY/TEAMTAILOR_COMPANY_NAME not set';
    logger.warn(`Teamtailor provider not registered: ${reason}`);
    outcomes.push({ providerId: 'teamtailor', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: teamtailorRequiredConfig });
  }

  // SmartRecruiters — requires company slug
  const smartRecruitersRequiredConfig = ['SMARTRECRUITERS_COMPANY', 'SMARTRECRUITERS_COMPANY_NAME'];
  if (config.SMARTRECRUITERS_COMPANY && config.SMARTRECRUITERS_COMPANY_NAME) {
    registry.register(
      createSmartRecruitersProvider({
        company: config.SMARTRECRUITERS_COMPANY,
        companyName: config.SMARTRECRUITERS_COMPANY_NAME,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'smartrecruiters', registered: true, configured: true, authenticated: 'not_required', requiredConfig: smartRecruitersRequiredConfig });
  } else {
    const reason = 'SMARTRECRUITERS_COMPANY/SMARTRECRUITERS_COMPANY_NAME not set';
    logger.warn(`SmartRecruiters provider not registered: ${reason}`);
    outcomes.push({ providerId: 'smartrecruiters', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: smartRecruitersRequiredConfig });
  }

  // Recruitee — requires company slug
  const recruiteeRequiredConfig = ['RECRUITEE_COMPANY', 'RECRUITEE_COMPANY_NAME'];
  if (config.RECRUITEE_COMPANY && config.RECRUITEE_COMPANY_NAME) {
    registry.register(
      createRecruiteeProvider({
        company: config.RECRUITEE_COMPANY,
        companyName: config.RECRUITEE_COMPANY_NAME,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'recruitee', registered: true, configured: true, authenticated: 'not_required', requiredConfig: recruiteeRequiredConfig });
  } else {
    const reason = 'RECRUITEE_COMPANY/RECRUITEE_COMPANY_NAME not set';
    logger.warn(`Recruitee provider not registered: ${reason}`);
    outcomes.push({ providerId: 'recruitee', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: recruiteeRequiredConfig });
  }

  // Comeet — requires company UID + token (both scoped to one company; see
  // https://developers.comeet.com/reference/careers-api-overview)
  const comeetRequiredConfig = ['COMEET_TOKEN', 'COMEET_COMPANY_UID', 'COMEET_COMPANY_NAME'];
  if (config.COMEET_TOKEN && config.COMEET_COMPANY_UID && config.COMEET_COMPANY_NAME) {
    registry.register(
      createComeetProvider({
        token: config.COMEET_TOKEN,
        companyUid: config.COMEET_COMPANY_UID,
        companyName: config.COMEET_COMPANY_NAME,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'comeet', registered: true, configured: true, authenticated: 'not_required', requiredConfig: comeetRequiredConfig });
  } else {
    const reason = 'COMEET_TOKEN/COMEET_COMPANY_UID/COMEET_COMPANY_NAME not set';
    logger.warn(`Comeet provider not registered: ${reason}`);
    outcomes.push({ providerId: 'comeet', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: comeetRequiredConfig });
  }

  // Personio — public unauthenticated per-tenant XML feed, but still
  // per-company like Greenhouse/Lever/etc. (see research/free-provider-expansion).
  // No default tenant (unlike Greenhouse's JetBrains default): skipped until configured.
  const personioRequiredConfig = ['PERSONIO_COMPANY', 'PERSONIO_COMPANY_NAME'];
  if (config.PERSONIO_COMPANY && config.PERSONIO_COMPANY_NAME) {
    registry.register(
      createPersonioProvider({
        company: config.PERSONIO_COMPANY,
        companyName: config.PERSONIO_COMPANY_NAME,
        language: config.PERSONIO_LANGUAGE,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'personio', registered: true, configured: true, authenticated: 'not_required', requiredConfig: personioRequiredConfig });
  } else {
    const reason = 'PERSONIO_COMPANY/PERSONIO_COMPANY_NAME not set';
    logger.warn(`Personio provider not registered: ${reason}`);
    outcomes.push({ providerId: 'personio', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: personioRequiredConfig });
  }

  // Workable — public unauthenticated per-tenant JSON widget endpoint, but
  // still per-company like Greenhouse/Personio/etc. (see research/free-provider-expansion).
  const workableRequiredConfig = ['WORKABLE_ACCOUNT_SLUG', 'WORKABLE_COMPANY_NAME'];
  if (config.WORKABLE_ACCOUNT_SLUG && config.WORKABLE_COMPANY_NAME) {
    registry.register(
      createWorkableProvider({
        accountSlug: config.WORKABLE_ACCOUNT_SLUG,
        companyName: config.WORKABLE_COMPANY_NAME,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'workable', registered: true, configured: true, authenticated: 'not_required', requiredConfig: workableRequiredConfig });
  } else {
    const reason = 'WORKABLE_ACCOUNT_SLUG/WORKABLE_COMPANY_NAME not set';
    logger.warn(`Workable provider not registered: ${reason}`);
    outcomes.push({ providerId: 'workable', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: workableRequiredConfig });
  }

  // Free providers — no API key needed, always register
  registry.register(
    createRemotiveProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'remotive', registered: true, configured: true, authenticated: 'not_required' });

  registry.register(
    createArbeitnowProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'arbeitnow', registered: true, configured: true, authenticated: 'not_required' });

  registry.register(
    createJobicyProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'jobicy', registered: true, configured: true, authenticated: 'not_required' });

  registry.register(
    createWWRProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'we_work_remotely', registered: true, configured: true, authenticated: 'not_required' });

  registry.register(
    createWorkingNomadsProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'working_nomads', registered: true, configured: true, authenticated: 'not_required' });

  registry.register(
    createPyJobsProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'pyjobs', registered: true, configured: true, authenticated: 'not_required' });

  registry.register(
    createDjangoJobsProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'django_jobs', registered: true, configured: true, authenticated: 'not_required' });

  registry.register(
    createSpeedrunProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'speedrun', registered: true, configured: true, authenticated: 'not_required' });

  registry.register(
    createNoDeskProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'nodesk', registered: true, configured: true, authenticated: 'not_required' });

  registry.register(
    createHNHiringProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'hn_hiring', registered: true, configured: true, authenticated: 'not_required' });

  // Habr Career — no auth, no config needed. High-value CIS IT source; see
  // habr-career-provider.ts for the RSS-feed ingestion approach.
  registry.register(
    createHabrCareerProvider({ logger, metrics: new ProviderInMemoryMetricsCollector(), tracer: new ProviderInMemoryTracer() })
  );
  outcomes.push({ providerId: 'habr_career', registered: true, configured: true, authenticated: 'not_required' });

  // SuperJob — requires an X-Api-App-Id secret key for every endpoint,
  // including plain search (unlike HH, there is no unauthenticated mode).
  const superjobRequiredConfig = ['SUPERJOB_API_KEY'];
  if (config.SUPERJOB_API_KEY) {
    registry.register(
      createSuperJobProvider({
        apiKey: config.SUPERJOB_API_KEY,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'superjob', registered: true, configured: true, authenticated: 'configured', requiredConfig: superjobRequiredConfig });
  } else {
    const reason = 'SUPERJOB_API_KEY not set';
    logger.warn(`SuperJob provider not registered: ${reason}`);
    outcomes.push({ providerId: 'superjob', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: superjobRequiredConfig });
  }

  // Telegram — COMMUNITY-type provider: scrapes public channels' `/s/`
  // preview pages (see packages/providers/src/providers/telegram/telegram-fetcher.ts),
  // no bot token or login needed. Only registered when at least one channel
  // is configured, same pattern as the board-scoped ATS providers above.
  // Priority: DB enabled channels > ENV fallback for migration compatibility.
  // TELEGRAM_CHANNELS env is kept only as migration fallback — DB is authoritative.
  const telegramRequiredConfig = ['TELEGRAM_CHANNELS (fallback)'];

  const { envChannelsList, channelProvider } = resolveTelegramChannelSource(config, telegramChannelRepo);
  const telegramChannels = envChannelsList;

  if (telegramChannels.length > 0 || channelProvider) {
    registry.register(
      createTelegramProvider({
        channels: telegramChannels,
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
        channelProvider,
        transportManager,
        extractionLookup,
      })
    );
    outcomes.push({ providerId: 'telegram', registered: true, configured: true, authenticated: 'not_required', requiredConfig: telegramRequiredConfig });
  } else {
    const reason = 'TELEGRAM_CHANNELS not set and no DB channels configured';
    logger.warn(`Telegram provider not registered: ${reason}`);
    outcomes.push({ providerId: 'telegram', registered: false, configured: false, authenticated: 'missing', reason, requiredConfig: telegramRequiredConfig });
  }

  // LinkedIn — Guest API, no auth required. Disable with LINKEDIN_ENABLED=false.
  if (config.LINKEDIN_ENABLED !== 'false') {
    registry.register(
      createLinkedInProvider({
        logger,
        metrics: new ProviderInMemoryMetricsCollector(),
        tracer: new ProviderInMemoryTracer(),
      })
    );
    outcomes.push({ providerId: 'linkedin', registered: true, configured: true, authenticated: 'not_required' });
  } else {
    const reason = 'LINKEDIN_ENABLED=false';
    logger.warn(`LinkedIn provider not registered: ${reason}`);
    outcomes.push({ providerId: 'linkedin', registered: false, configured: false, authenticated: 'not_required', reason });
  }

  return outcomes;
}

interface SocialMessageTransportWiring {
  readonly registry: SocialMessageTransportRegistry;
  readonly manager: TransportManager;
  readonly botApiTransport: BotApiTransport;
}

/**
 * Registers EPIC-12 Phase 2's transport layer (ADR-032 addendum) into its own
 * SocialMessageTransportRegistry/TransportManager. Uses its own TelegramFetcher
 * instance (same class/scrape logic createTelegramProvider() uses, not a fork
 * of it) to do the actual `t.me/s/<channel>` scrape.
 *
 * Phase 2.5 (ADR-032 addendum) wires the resulting TransportManager into two
 * places, both downstream of this function: (1) the vacancy-sync
 * TelegramFetcher instance (constructed in registerConfiguredProviders(),
 * passed the `transportManager` this function returns) now routes its
 * message fetching through TransportManager instead of scraping directly —
 * the RawJob[] output contract to Mapper/Normalizer/SyncStrategy is
 * unchanged, so the existing SyncScheduler → dedup → persistence → Dashboard
 * pipeline sees no behavior change; (2) SocialMessageIngestionService calls
 * TransportManager.fetch() directly to persist SocialMessage rows, via
 * SyncSchedulerService's onProviderSynced hook. Phase 4/5 (SocialMessagePipeline,
 * SocialMessageMapper/Normalizer) is what actually turns those SocialMessage
 * rows into extractions and, once extracted, Vacancy rows — nothing in this
 * function does either.
 */
function registerSocialMessageTransports(
  config: Config,
  logger: ProviderLogger,
  telegramChannelRepo?: PrismaTelegramChannelRepository,
): SocialMessageTransportWiring {
  const registry = new SocialMessageTransportRegistry();
  const metrics = new ProviderInMemoryMetricsCollector();
  const tracer = new ProviderInMemoryTracer();

  const { channelProvider } = resolveTelegramChannelSource(config, telegramChannelRepo);
  const telegramFetcher = new TelegramFetcher({ channels: [], logger, metrics, tracer, channelProvider });

  const htmlPreviewTransport = new HtmlPreviewTransport({ logger, metrics, tracer, fetcher: telegramFetcher });
  const botApiTransport = new BotApiTransport({ logger, metrics, tracer });

  // Registration order = resolve() preference: once a bot token is
  // configured, prefer the richer API transport over scraping the public
  // preview page (SocialMessageTransportRegistry.resolve() doc comment).
  if (config.TELEGRAM_BOT_TOKEN) {
    registry.register('telegram', botApiTransport);
  }
  registry.register('telegram', htmlPreviewTransport);

  const manager = new TransportManager({ registry, logger, metrics, tracer });

  return { registry, manager, botApiTransport };
}

/**
 * ADR-032 Phase 4/5 cutover seam: given a channel + platform-native message
 * ID, resolve the SocialMessage the SocialMessage pipeline already ingested
 * and its latest MessageExtraction, if any. Shared by createTelegramExtractionLookup
 * (below, feeds RawJob fields) and createTelegramDiscoveryFilter (feeds the
 * Company Discovery bridge) so the two-query lookup isn't duplicated between them.
 */
function resolveTelegramMessageExtraction(
  socialMessageRepository: PrismaSocialMessageRepository,
  messageExtractionRepository: PrismaMessageExtractionRepository,
  channel: string,
  messageId: string,
): Promise<MessageExtraction | undefined> {
  return socialMessageRepository
    .findBySourceAndExternalId(SocialPlatform.TELEGRAM, channel, messageId)
    .then((message) => (message ? messageExtractionRepository.findLatestByMessageId(message.id) : null))
    .then((extraction) => extraction ?? undefined);
}

/**
 * Given a channel + platform-native message ID, resolve the SocialMessage
 * the SocialMessage pipeline already ingested and extracted, and shape its
 * latest MessageExtraction into the plain fields TelegramFetcher.buildRawJob()
 * needs. Only a SUCCESS-status
 * extraction qualifies — LOW_CONFIDENCE/SPAM/PARSE_ERROR/PROVIDER_ERROR all
 * resolve to `undefined`, same as "not extracted yet", which is exactly
 * "rows below the confidence threshold never reach this step" (ADR-032).
 */
function createTelegramExtractionLookup(
  socialMessageRepository: PrismaSocialMessageRepository,
  messageExtractionRepository: PrismaMessageExtractionRepository,
): TelegramExtractionLookup {
  return async (channel: string, messageId: string): Promise<TelegramExtractedFields | undefined> => {
    const extraction = await resolveTelegramMessageExtraction(socialMessageRepository, messageExtractionRepository, channel, messageId);
    if (!extraction || extraction.status !== MessageExtractionStatus.SUCCESS) return undefined;

    const fields = extraction.extractedFields;
    return {
      company: fields.company,
      title: fields.title,
      technologies: fields.technologies,
      skills: fields.skills,
      seniority: fields.seniority,
      salaryMin: fields.salaryMin,
      salaryMax: fields.salaryMax,
      currency: fields.currency,
      country: fields.country,
      city: fields.city,
      employmentType: fields.employmentType,
      remoteType: fields.remoteType,
      links: fields.links,
      requirements: fields.requirements,
      responsibilities: fields.responsibilities,
    };
  };
}

/**
 * ADR-035 Phase 3 extension: gates which Telegram-sourced NormalizedVacancy
 * rows are trusted enough to feed VacancyDiscoveryBridge.processVacancies()
 * (i.e. create a CompanyCandidate). Deliberately a *stricter* bar than the
 * one createTelegramExtractionLookup already applies to reach Vacancy
 * creation at all — MESSAGE_EXTRACTION_DISCOVERY_MIN_CONFIDENCE (70) vs.
 * SUCCESS's implicit >=40 — plus a requirement for a real extracted company
 * name and an external (non-t.me, non-mailto) link to use as companyUrl,
 * since NormalizedVacancy.companyUrl is never set by TelegramFetcher itself.
 * Returns undefined for anything that doesn't qualify — those vacancies
 * still exist (created via the unconditional Vacancy-sync path), they just
 * never reach the discovery bridge, same "not eligible" convention used
 * throughout this file rather than a thrown error.
 */
export function createTelegramDiscoveryFilter(
  socialMessageRepository: PrismaSocialMessageRepository,
  messageExtractionRepository: PrismaMessageExtractionRepository,
): (vacancy: NormalizedVacancy) => Promise<VacancyForDiscovery | undefined> {
  return async (vacancy: NormalizedVacancy): Promise<VacancyForDiscovery | undefined> => {
    const separator = vacancy.sourceId.indexOf(':');
    if (separator === -1) return undefined;
    const channel = vacancy.sourceId.slice(0, separator);
    const messageId = vacancy.sourceId.slice(separator + 1);

    const extraction = await resolveTelegramMessageExtraction(socialMessageRepository, messageExtractionRepository, channel, messageId);
    if (!extraction) return undefined;
    if (extraction.status !== MessageExtractionStatus.SUCCESS) return undefined;
    if (extraction.deterministicConfidence < MESSAGE_EXTRACTION_DISCOVERY_MIN_CONFIDENCE) return undefined;

    const fields = extraction.extractedFields;
    if (!fields.company || !fields.company.trim()) return undefined;

    const companyUrl = fields.links.find(
      (link) => /^https?:\/\//i.test(link) && !/^https?:\/\/t\.me\//i.test(link) && !link.startsWith('mailto:')
    );
    if (!companyUrl) return undefined;

    return { companyName: fields.company, companyUrl, title: vacancy.title };
  };
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
  const vacancySourceRepository = new PrismaVacancySourceRepository();
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
  const tailoredResumeRepository = new PrismaTailoredResumeRepository();
  const companyWatchRepository = new PrismaCompanyWatchRepository();
  const companyWatchEventRepository = new PrismaCompanyWatchEventRepository();
  const companyWatchSyncLogRepository = new PrismaCompanyWatchSyncLogRepository();
  const companyCandidateRepository = new PrismaCompanyCandidateRepository();
  const aiJobRepository = new PrismaAIJobRepository();
  const aiCacheRepository = new PrismaAICacheRepository();
  const aiUsageRepository = new PrismaAIUsageRepository();
  const aiProviderConfigRepository = new PrismaAIProviderConfigRepository();
  const aiBudgetRepository = new PrismaAIBudgetRepository();
  // Shared budget gate for bulk/background AI call sites that bypass
  // AIOrchestrator.execute() (AiMatchingService, SearchProfileSuggestionService)
  // — AIOrchestrator constructs its own internally for the orchestrated routes.
  // Honors the same AI_BUDGET_CHECK_ENABLED toggle as the orchestrator (undefined = no cap).
  const bulkAiBudgetEnforcer = config.AI_BUDGET_CHECK_ENABLED
    ? new BudgetEnforcer(aiBudgetRepository, new UsageTracker(aiUsageRepository))
    : undefined;
  // Same bulk/background call sites as bulkAiBudgetEnforcer above, but for
  // *persisting* usage instead of gating it — without this, MatchingEngine,
  // ResumeExtractionEngine, and SearchProfileSuggestionService spend real AI
  // provider budget that never shows up in the AI usage dashboard (which reads
  // only from AIUsageRepository, populated otherwise solely by AIOrchestrator.execute()).
  const bulkUsageRecorder: UsageRecorder = {
    record: async (input) => {
      await aiUsageRepository.create(input);
    },
  };
  const analyticsEventRepository = new PrismaAnalyticsEventRepository();
  const careerInsightRepository = new PrismaCareerInsightRepository();
  const providerConfigRepository = new PrismaProviderConfigRepository();
  const telegramChannelRepository = new PrismaTelegramChannelRepository();
  const telegramChannelStatsRepository = new PrismaTelegramChannelStatsRepository();

  // Bootstrap: makes the TelegramChannel DB table the source of truth from
  // this boot onward, with no manual script required. seedFromEnv() is
  // idempotent (only inserts usernames that don't already exist yet), so
  // calling it on every boot is safe — the first boot populates the table,
  // every later boot is a no-op. Fire-and-forget/best-effort: buildContainer()
  // is synchronous and must never block startup on this, and
  // resolveTelegramChannelSource()'s channelProvider already falls back to
  // TELEGRAM_CHANNELS for any sync tick that runs before this lands.
  if (config.TELEGRAM_CHANNELS) {
    telegramChannelRepository.seedFromEnv(config.TELEGRAM_CHANNELS).catch((error) => {
      console.warn('Telegram channel DB bootstrap failed, TELEGRAM_CHANNELS env fallback remains active:', error instanceof Error ? error.message : error);
    });
  }
  const qualityDataRepository = new PrismaQualityDataRepository();
  const userVacancyInteractionRepository = new PrismaUserVacancyInteractionRepository();
  const socialMessageRepository = new PrismaSocialMessageRepository();
  const messageExtractionRepository = new PrismaMessageExtractionRepository();

  const authProvider = createAuthProvider({
    jwtSecret: config.JWT_SECRET,
    jwtAccessExpiresIn: config.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
    argon2MemoryCost: config.ARGON2_MEMORY_COST,
    argon2TimeCost: config.ARGON2_TIME_COST,
    argon2Parallelism: config.ARGON2_PARALLELISM,
  });

  // Built before registerConfiguredProviders() (Phase 2.5, ADR-032 addendum)
  // so the resulting TransportManager can be threaded into
  // createTelegramProvider() below — its TelegramFetcher routes message
  // fetching through it instead of scraping directly.
  const {
    registry: socialMessageTransportRegistry,
    manager: transportManager,
    botApiTransport,
  } = registerSocialMessageTransports(config, new ProviderConsoleLogger(config.LOG_LEVEL), telegramChannelRepository);

  // ADR-032 Phase 4/5 cutover seam: buildRawJob() calls this instead of
  // regex-extracting when it wants V2 behavior — see createTelegramProvider() below.
  const telegramExtractionLookup = createTelegramExtractionLookup(socialMessageRepository, messageExtractionRepository);

  const providerRegistry = new ProviderRegistry();
  const registrationOutcomes = registerConfiguredProviders(
    providerRegistry,
    config,
    new ProviderConsoleLogger(config.LOG_LEVEL),
    telegramChannelRepository,
    transportManager,
    telegramExtractionLookup,
  );

  const socialMessageIngestionService = new SocialMessageIngestionService(
    transportManager,
    socialMessageRepository,
    new ProviderConsoleLogger(config.LOG_LEVEL),
    new ProviderInMemoryMetricsCollector(),
  );

  const { channelProvider: telegramChannelsForIngestion } = resolveTelegramChannelSource(config, telegramChannelRepository);

  const providerHealthMonitor = new ProviderHealthMonitor({
    checkIntervalMs: 5 * 60 * 1000,
    unhealthyThreshold: 3,
    degradedThresholdMs: 3000,
    healthyThresholdMs: 1000,
  });
  const providerDiagnosticsService = new ProviderDiagnosticsService(providerHealthMonitor);
  providerDiagnosticsService.recordRegistrations(registrationOutcomes);
  // Wired after syncSchedulerService is constructed below (see setSyncScheduler
  // doc comment) so Diagnostics and Provider Management read the same live
  // health signal instead of two independently-derived ones.
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
    usageRecorder: bulkUsageRecorder,
  });

  // EPIC-12 Phase 3 (ADR-032): own AICache/CostTracker/Tracer instances, same
  // convention as matchingEngine above — engines don't share cache state,
  // each keys its own cache by its own inputs.
  const messageExtractionEngine = new MessageExtractionEngine({
    provider: aiProvider,
    promptBuilder: new MessageExtractionPromptBuilder(),
    repository: messageExtractionRepository,
    cache: new InMemoryAICache(),
    costTracker: new InMemoryCostTracker(),
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    metrics: new InMemoryAIMetricsCollector(),
    tracer: new InMemoryAITracer(),
  });

  // ADR-032 Phase 4/5: the pending-message loop messageExtractionEngine was
  // built for but never wired to. Driven by the same onProviderSynced hook
  // SocialMessageIngestionService uses, immediately after ingestion so a
  // freshly-ingested batch is classified/extracted the same sync cycle.
  const socialMessagePipeline = new SocialMessagePipeline(
    socialMessageRepository,
    messageExtractionEngine,
    new ProviderConsoleLogger(config.LOG_LEVEL),
    new ProviderInMemoryMetricsCollector(),
  );

  const telegramChannelStatsService = new TelegramChannelStatsService(telegramChannelStatsRepository);

  // Gates which Telegram vacancies are trusted enough to create a
  // CompanyCandidate — see createTelegramDiscoveryFilter's doc comment.
  const telegramDiscoveryFilter = createTelegramDiscoveryFilter(socialMessageRepository, messageExtractionRepository);

  // Phase 2.5/4.5: fires after every successful 'telegram' sync tick so
  // SocialMessage ingestion + extraction run on the exact same cadence as
  // the existing Vacancy sync, without SyncSchedulerService knowing anything
  // about Telegram or channels (see its onProviderSynced doc comment).
  // Sequential per channel (not Promise.all across both steps) because the
  // pipeline reads PENDING rows this same ingestSource() call just wrote.
  const onProviderSynced = async (providerId: string, vacancies: readonly VacancyForDiscovery[]): Promise<void> => {
    // Telegram: social message ingestion
    if (providerId === 'telegram') {
      const channels = (await telegramChannelsForIngestion?.()) ?? [];
      await Promise.all(
        channels.map(async (channel) => {
          await socialMessageIngestionService.ingestSource('telegram', SocialPlatform.TELEGRAM, { sourceId: channel });
          await socialMessagePipeline.processPendingBySource(SocialPlatform.TELEGRAM, channel);

          const channelRecord = await telegramChannelRepository.findByUsername(channel);
          if (channelRecord) {
            await telegramChannelStatsService.computeAndPersist(channel, channelRecord.id);
          }
        })
      );

      // ADR-035 Phase 3 extension: unlike every other provider, Telegram
      // vacancies only reach the discovery bridge if their originating
      // MessageExtraction clears a stricter, separate confidence bar (see
      // createTelegramDiscoveryFilter) — SyncSchedulerService always passes
      // the real NormalizedVacancy[] here (sync-scheduler-service.ts's
      // onProviderSynced call site), so this cast just recovers the fields
      // the narrower VacancyForDiscovery callback type doesn't expose.
      if (companyDiscoveryBridge) {
        try {
          const telegramVacancies = vacancies as readonly NormalizedVacancy[];
          const eligible = (
            await Promise.all(telegramVacancies.map((vacancy) => telegramDiscoveryFilter(vacancy)))
          ).filter((v): v is VacancyForDiscovery => v !== undefined);

          if (eligible.length > 0) {
            await companyDiscoveryBridge.processVacancies(eligible, 'telegram');
          }
        } catch (discoveryError) {
          console.warn('VacancyDiscoveryBridge failed (telegram):', discoveryError instanceof Error ? discoveryError.message : discoveryError);
        }
      }
      return;
    }

    // ADR-035 Phase 3: vacancy discovery bridge for all non-telegram providers
    if (vacancies.length > 0 && companyDiscoveryBridge) {
      try {
        await companyDiscoveryBridge.processVacancies(vacancies, providerId);
      } catch (discoveryError) {
        console.warn('VacancyDiscoveryBridge failed:', discoveryError instanceof Error ? discoveryError.message : discoveryError);
      }
    }
  };

  const aiMetrics = new InMemoryAIMetricsCollector();
  const applicationService = new ApplicationServiceImpl(applicationRepository);

  const searchProfileService = new SearchProfileService(searchProfileRepository);
  const providerSearchService = new ProviderSearchService(
    providerRegistry,
    vacancyRepository,
    vacancySourceRepository,
    companyRepository,
    new ProviderConsoleLogger(config.LOG_LEVEL),
    new ProviderInMemoryMetricsCollector(),
    config.PROVIDER_TIMEOUT_MS,
    config.PROVIDER_SEARCH_LIMIT,
    config.MIN_RELEVANCE_SCORE,
    providerDiagnosticsService,
    true,
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
    new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    config.AI_MIN_TRIAGE_SCORE,
    bulkAiBudgetEnforcer
  );
  const recommendationService = new RecommendationService(aiMetrics);
  const applicationCreationService = new ApplicationCreationService(applicationService, analyticsEventRepository);
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
    followUpService,
    analyticsEventRepository
  );
  const recruiterService = new RecruiterService(recruiterRepository);
  const vacancyAnalysisQueue: VacancyAnalysisQueue = new BullMqVacancyAnalysisQueue(config.REDIS_URL);
  const resumeTailoringQueue: ResumeTailoringQueue = new BullMqResumeTailoringQueue(config.REDIS_URL);
  const tailoringRequestService = new TailoringRequestService(tailoredResumeRepository, resumeTailoringQueue);
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
    searchRunTraceRecorder,
    analyticsEventRepository
  );

  const digestMetrics = new ProviderInMemoryMetricsCollector();
  const telegramClient = createTelegramClient(config);
  const morningDigestService = new MorningDigestService(
    intelligenceWorkflowService,
    notificationHistoryRepository,
    companyRepository,
    new DigestBuilder(),
    digestMetrics,
    followUpService
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

  const workspaceService = new WorkspaceService(workspaceRepository, userRepository);

  const resumeService = new ResumeService(resumeRepository);

  const extractionEngine = new ResumeExtractionEngine(
    {
      provider: aiProvider,
      promptBuilder: new StructuredResumeExtractionPromptBuilder(),
      logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
      metrics: new InMemoryAIMetricsCollector(),
      usageRecorder: bulkUsageRecorder,
    },
    { maxRetries: 2, timeoutMs: 60_000 }
  );

  const searchProfileSuggestionService = new SearchProfileSuggestionService(
    resumeRepository,
    suggestionAIProvider,
    structuredResumeRepository,
    extractionEngine,
    '1.0.0',
    new SearchProfileSuggestionPromptBuilder(),
    bulkAiBudgetEnforcer,
    bulkUsageRecorder
  );

  // Distributed across replicas via Redis (SET NX), unlike a per-process Map —
  // see ADR-019.
  const syncRateLimiter = new RedisRateLimiter(getRedis(config.REDIS_URL), 'sync-rate-limit', 60_000);

  const syncSchedulerService = new SyncSchedulerService(
    providerRegistry,
    vacancyRepository,
    vacancySourceRepository,
    companyRepository,
    new ProviderConsoleLogger(config.LOG_LEVEL),
    new ProviderInMemoryMetricsCollector(),
    60 * 60 * 1000,
    providerConfigRepository,
    onProviderSynced,
  );
  providerDiagnosticsService.setSyncScheduler(syncSchedulerService);

  const dashboardStatsService = new DashboardStatsService(
    vacancyRepository,
    applicationRepository,
    matchResultRepository,
  );
  const notificationDispatcherService = new NotificationDispatcherService(
    matchResultRepository,
    vacancyRepository,
    applicationRepository,
    telegramClient,
  );

  const atsAdapterRegistry = new AtsAdapterRegistry();
  const companyWatchService = new CompanyWatchService(
    companyWatchRepository,
    companyWatchEventRepository,
    companyWatchSyncLogRepository,
    atsAdapterRegistry
  );

  // ADR-035 Phase 2: single-shot discovery pipeline built on top of the
  // existing CompanyDiscoveryService/AtsAdapterRegistry/CompanyWatchService —
  // no parallel fingerprinting, ATS-fetch, or enrollment path.
  const companyDiscoveryIntakeService = new CompanyDiscoveryIntakeService(
    companyCandidateRepository,
    companyWatchRepository,
    companyWatchService,
    new CompanyDiscoveryService(),
    atsAdapterRegistry,
    new CandidateDeduplicationService(),
    config.DISCOVERY_WORKSPACE_ID
  );
  const companyDiscoveryDiagnosticsService = new CompanyDiscoveryDiagnosticsService(companyCandidateRepository);

  // ADR-035 Phase 3: vacancy discovery bridge — auto-discovers companies
  // from the vacancy sync pipeline and converts high-confidence candidates
  // to CompanyWatch.
  const companyDiscoveryBridge = new VacancyDiscoveryBridge(
    companyCandidateRepository,
    companyWatchRepository,
    companyWatchService,
    new CompanyDiscoveryService(),
    atsAdapterRegistry,
    new CandidateDeduplicationService(),
    {
      autoEnrollWorkspaceId: config.DISCOVERY_WORKSPACE_ID,
      sourceAuthorityScore: 30,
      // Community/crowd-sourced Telegram posts are a weaker signal than an
      // ATS API or job-board listing (same COMMUNITY tier source-priority.ts
      // already ranks Telegram at) — lower trust here, never higher.
      sourceAuthorityScoreByProvider: { telegram: 15 },
    },
    {
      info: (msg, ctx) => console.log(`[VacancyDiscovery] ${msg}`, ctx ?? ''),
      warn: (msg, ctx) => console.warn(`[VacancyDiscovery] ${msg}`, ctx ?? ''),
      error: (msg, err, ctx) => console.error(`[VacancyDiscovery] ${msg}`, err, ctx ?? ''),
      debug: (msg, ctx) => { if (config.LOG_LEVEL === 'debug') console.debug(`[VacancyDiscovery] ${msg}`, ctx ?? ''); },
    },
  );

  const careerIntelligenceService = new CareerIntelligenceService({
    applicationRepository,
    vacancyRepository,
    vacancySourceRepository,
    companyRepository,
    matchResultRepository,
    analyticsEventRepository,
    careerInsightRepository,
  });

  const resumeVersionIntelligenceService = new ResumeVersionIntelligenceService({
    resumeRepository,
    applicationRepository,
    vacancyRepository,
    vacancySourceRepository,
    companyRepository,
    matchResultRepository,
    careerInsightRepository,
  });

  const providerManagementService = new ProviderManagementService(
    providerConfigRepository,
    telegramChannelRepository,
    providerRegistry,
    syncSchedulerService,
    new ProviderConsoleLogger(config.LOG_LEVEL),
    qualityDataRepository,
    providerDiagnosticsService,
  );

  // AI Orchestrator
  const aiHandlers = new Map<AIFeature, JobHandler>();
  // Delegates to analyzeVacancyForSearchProfile (the same reuse-checked path
  // AiMatchingService's bulk matching uses) instead of calling the LLM
  // directly, so a vacancy already scored via bulk matching is never
  // re-analyzed for the same (vacancy, profile[, resume]) triple just because
  // the user clicked "Analyze" on the application instead.
  aiHandlers.set('analyze_vacancy', new AnalyzeVacancyHandler({
    matchResultRepository,
    cache: new InMemoryAICache(),
    costTracker: new InMemoryCostTracker(),
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    metrics: new InMemoryAIMetricsCollector(),
    tracer: new InMemoryAITracer(),
  }));
  // 'tailor_resume' is no longer registered here — ADR-031 moved resume
  // tailoring to its own async pipeline (TailoringRequestService +
  // apps/worker), not this synchronous orchestrator.
  aiHandlers.set('cover_letter', new CoverLetterHandler());
  aiHandlers.set('interview_prep', new InterviewPrepHandler());
  aiHandlers.set('salary_analysis', new SalaryAnalysisHandler());
  aiHandlers.set('company_analysis', new CompanyAnalysisHandler());
  aiHandlers.set('resume_improvement', new ResumeImprovementHandler());
  aiHandlers.set('career_advice', new CareerAdviceHandler());

  const featureProviderMap = config.AI_FEATURE_PROVIDER_MAP
    ? JSON.parse(config.AI_FEATURE_PROVIDER_MAP) as Partial<Record<AIFeature, string>>
    : undefined;

  const aiOrchestrator = new AIOrchestrator(
    {
      aiProvider,
      aiJobRepository,
      aiCacheRepository,
      aiUsageRepository,
      aiProviderConfigRepository,
      aiBudgetRepository,
      logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    },
    {
      redisUrl: config.REDIS_URL,
      defaultProvider: config.AI_PROVIDER,
      defaultModel: config.AI_MODEL,
      fallbackProviders: config.AI_FALLBACK_PROVIDERS?.split(',').filter(Boolean),
      cacheTtlMs: config.AI_CACHE_TTL_MS,
      maxRetries: 3,
      budgetCheckEnabled: config.AI_BUDGET_CHECK_ENABLED,
      aiMode: config.AI_ORCHESTRATOR_MODE,
      featureProviderMap,
    },
    aiHandlers
  );

  return {
    repositories: {
      user: userRepository,
      resume: resumeRepository,
      vacancy: vacancyRepository,
      vacancySource: vacancySourceRepository,
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
      tailoredResume: tailoredResumeRepository,
      aiJob: aiJobRepository,
      aiCache: aiCacheRepository,
      aiUsage: aiUsageRepository,
      aiProviderConfig: aiProviderConfigRepository,
      aiBudget: aiBudgetRepository,
      analyticsEvent: analyticsEventRepository,
      careerInsight: careerInsightRepository,
      providerConfig: providerConfigRepository,
      telegramChannel: telegramChannelRepository,
      userVacancyInteraction: userVacancyInteractionRepository,
      socialMessage: socialMessageRepository,
      messageExtraction: messageExtractionRepository,
      companyCandidate: companyCandidateRepository,
    },
    authProvider,
    providerRegistry,
    providerHealthMonitor,
    socialMessageTransportRegistry,
    transportManager,
    botApiTransport,
    providerDiagnostics: providerDiagnosticsService,
    companyDiscoveryDiagnostics: companyDiscoveryDiagnosticsService,
    searchRunTraces: searchRunTraceRecorder,
    queueDiagnostics: queueDiagnosticsService,
    aiProvider,
    aiProviderHealthMonitor,
    aiMetrics,
    aiOrchestrator,
    messageExtractionEngine,
    applicationService,
    services: {
      auth: authService,
      workspace: workspaceService,
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
      syncScheduler: syncSchedulerService,
      syncRateLimiter,
      dashboardStats: dashboardStatsService,
      notificationDispatcher: notificationDispatcherService,
      companyWatch: companyWatchService,
      companyDiscoveryIntake: companyDiscoveryIntakeService,
      careerIntelligence: careerIntelligenceService,
      resumeVersionIntelligence: resumeVersionIntelligenceService,
      providerManagement: providerManagementService,
      tailoringRequest: tailoringRequestService,
      socialMessageIngestion: socialMessageIngestionService,
      socialMessagePipeline,
      telegramChannelStats: telegramChannelStatsService,
    },
  };
}

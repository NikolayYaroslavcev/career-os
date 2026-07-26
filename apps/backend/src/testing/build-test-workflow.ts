import {
  MatchingEngine,
  VacancyAnalysisPromptBuilder,
  InMemoryAICache,
  InMemoryCostTracker,
  NoopAILogger,
  InMemoryAIMetricsCollector,
  InMemoryAITracer,
} from '@careeros/ai';
import {
  ProviderRegistry,
  FakeProvider,
  NoopLogger as ProviderNoopLogger,
  InMemoryMetricsCollector as ProviderInMemoryMetricsCollector,
} from '@careeros/providers';
import type { FakeProviderBehavior } from '@careeros/providers';
import { InMemoryTelegramClient } from '@careeros/telegram';
import { InMemoryAiBatchBacklog } from '@careeros/shared';
import { SearchProfileService } from '../services/search-profile-service.js';
import { ProviderSearchService } from '../services/provider-search-service.js';
import { AiMatchingService } from '../services/ai-matching-service.js';
import { RecommendationService } from '../services/recommendation-service.js';
import { ApplicationCreationService } from '../services/application-creation-service.js';
import { IntelligenceWorkflowService } from '../services/intelligence-workflow-service.js';
import { SearchRunTraceRecorder } from '../services/search-run-trace.js';
import { MorningDigestService } from '../services/morning-digest-service.js';
import { DigestBuilder } from '../services/digest-builder.js';
import { TelegramDigestFormatter } from '../services/telegram-digest-formatter.js';
import { DigestDeliveryService } from '../services/digest-delivery-service.js';
import { ManualDigestScheduler } from '../services/digest-scheduler.js';
import { TelegramLinkingService } from '../services/telegram-linking-service.js';
import { SearchProfileSuggestionService } from '../services/search-profile-suggestion-service.js';
import { MockAIProvider } from './mock-ai-provider.js';
import { MockSuggestionAIProvider } from './mock-suggestion-ai-provider.js';
import {
  InMemoryUserRepository,
  InMemoryResumeRepository,
  InMemoryVacancyRepository,
  InMemoryVacancySourceRepository,
  InMemoryCompanyRepository,
  InMemoryApplicationRepository,
  InMemorySearchProfileRepository,
  InMemoryMatchResultRepository,
  InMemoryNotificationHistoryRepository,
  InMemoryTelegramConnectionRepository,
  InMemoryTelegramLinkingTokenRepository,
  InMemoryStructuredResumeRepository,
  InMemoryVacancyAnalysisQueue,
} from './in-memory-repositories.js';
import { ApplicationServiceImpl } from '@careeros/career';
import { buildFixtureUser } from './fixtures.js';

export interface TestWorkflow {
  readonly repositories: {
    readonly user: InMemoryUserRepository;
    readonly resume: InMemoryResumeRepository;
    readonly vacancy: InMemoryVacancyRepository;
    readonly company: InMemoryCompanyRepository;
    readonly application: InMemoryApplicationRepository;
    readonly searchProfile: InMemorySearchProfileRepository;
    readonly matchResult: InMemoryMatchResultRepository;
    readonly notificationHistory: InMemoryNotificationHistoryRepository;
    readonly telegramConnection: InMemoryTelegramConnectionRepository;
    readonly telegramLinkingToken: InMemoryTelegramLinkingTokenRepository;
  };
  readonly services: {
    readonly searchProfile: SearchProfileService;
    readonly providerSearch: ProviderSearchService;
    readonly aiMatching: AiMatchingService;
    readonly recommendation: RecommendationService;
    readonly applicationCreation: ApplicationCreationService;
    readonly intelligenceWorkflow: IntelligenceWorkflowService;
    readonly morningDigest: MorningDigestService;
    readonly digestDelivery: DigestDeliveryService;
    readonly digestScheduler: ManualDigestScheduler;
    readonly telegramLinking: TelegramLinkingService;
    readonly searchProfileSuggestion: SearchProfileSuggestionService;
  };
  readonly aiMetrics: InMemoryAIMetricsCollector;
  readonly providerMetrics: ProviderInMemoryMetricsCollector;
  readonly telegramClient: InMemoryTelegramClient;
  readonly vacancyAnalysisQueue: InMemoryVacancyAnalysisQueue;
  readonly aiBatchBacklog: InMemoryAiBatchBacklog;
  readonly searchRunTraces: SearchRunTraceRecorder;
}

/**
 * Builds the full EPIC-08 service graph against fixture-based, network-free
 * dependencies: an in-memory FakeProvider standing in for RemoteOK, and a
 * deterministic MockAIProvider standing in for the real AI vendor call.
 * Used by both integration tests and the `pnpm demo:intelligence` script.
 */
export interface TestWorkflowOptions {
  readonly aiEnabled?: boolean;
}

export function buildTestWorkflow(providerBehavior?: FakeProviderBehavior, options?: TestWorkflowOptions): TestWorkflow {
  const userRepository = new InMemoryUserRepository();
  const resumeRepository = new InMemoryResumeRepository();
  const vacancyRepository = new InMemoryVacancyRepository();
  const vacancySourceRepository = new InMemoryVacancySourceRepository();
  const companyRepository = new InMemoryCompanyRepository();
  const applicationRepository = new InMemoryApplicationRepository();
  const searchProfileRepository = new InMemorySearchProfileRepository();
  const matchResultRepository = new InMemoryMatchResultRepository();
  const notificationHistoryRepository = new InMemoryNotificationHistoryRepository();
  const telegramConnectionRepository = new InMemoryTelegramConnectionRepository();
  const telegramLinkingTokenRepository = new InMemoryTelegramLinkingTokenRepository();
  void userRepository.save(buildFixtureUser());

  const providerRegistry = new ProviderRegistry();
  const providerMetrics = new ProviderInMemoryMetricsCollector();
  providerRegistry.register(new FakeProvider('remote_ok', providerBehavior));

  const aiMetrics = new InMemoryAIMetricsCollector();
  const matchingEngine = new MatchingEngine({
    provider: new MockAIProvider(),
    promptBuilder: new VacancyAnalysisPromptBuilder(),
    cache: new InMemoryAICache(),
    costTracker: new InMemoryCostTracker(),
    logger: new NoopAILogger(),
    metrics: aiMetrics,
    tracer: new InMemoryAITracer(),
  });

  const applicationService = new ApplicationServiceImpl(applicationRepository);

  const searchProfileService = new SearchProfileService(searchProfileRepository);
  const providerSearchService = new ProviderSearchService(
    providerRegistry,
    vacancyRepository,
    vacancySourceRepository,
    companyRepository,
    new ProviderNoopLogger(),
    providerMetrics
  );
  const aiMatchingService = new AiMatchingService(matchingEngine, matchResultRepository, companyRepository, aiMetrics);
  const recommendationService = new RecommendationService(aiMetrics);
  const applicationCreationService = new ApplicationCreationService(applicationService);
  const vacancyAnalysisQueue = new InMemoryVacancyAnalysisQueue();
  const aiBatchBacklog = new InMemoryAiBatchBacklog();
  const searchRunTraces = new SearchRunTraceRecorder();
  const intelligenceWorkflowService = new IntelligenceWorkflowService(
    searchProfileService,
    providerSearchService,
    aiMatchingService,
    recommendationService,
    resumeRepository,
    userRepository,
    vacancyRepository,
    vacancyAnalysisQueue,
    new NoopAILogger(),
    options?.aiEnabled ?? true,
    aiBatchBacklog,
    searchRunTraces
  );

  const digestBuilder = new DigestBuilder();
  const telegramClient = new InMemoryTelegramClient();
  const morningDigestService = new MorningDigestService(
    intelligenceWorkflowService,
    notificationHistoryRepository,
    companyRepository,
    digestBuilder,
    providerMetrics
  );
  const digestDeliveryService = new DigestDeliveryService(
    morningDigestService,
    new TelegramDigestFormatter(),
    telegramClient,
    telegramConnectionRepository,
    notificationHistoryRepository,
    providerMetrics,
    new ProviderNoopLogger()
  );
  const digestScheduler = new ManualDigestScheduler(digestDeliveryService);
  const telegramLinkingService = new TelegramLinkingService(
    userRepository,
    telegramConnectionRepository,
    telegramLinkingTokenRepository,
    providerMetrics,
    new ProviderNoopLogger()
  );

  const searchProfileSuggestionService = new SearchProfileSuggestionService(
    resumeRepository,
    new MockSuggestionAIProvider(),
    new InMemoryStructuredResumeRepository()
  );

  return {
    repositories: {
      user: userRepository,
      resume: resumeRepository,
      vacancy: vacancyRepository,
      company: companyRepository,
      application: applicationRepository,
      searchProfile: searchProfileRepository,
      matchResult: matchResultRepository,
      notificationHistory: notificationHistoryRepository,
      telegramConnection: telegramConnectionRepository,
      telegramLinkingToken: telegramLinkingTokenRepository,
    },
    services: {
      searchProfile: searchProfileService,
      providerSearch: providerSearchService,
      aiMatching: aiMatchingService,
      recommendation: recommendationService,
      applicationCreation: applicationCreationService,
      intelligenceWorkflow: intelligenceWorkflowService,
      morningDigest: morningDigestService,
      digestDelivery: digestDeliveryService,
      digestScheduler,
      telegramLinking: telegramLinkingService,
      searchProfileSuggestion: searchProfileSuggestionService,
    },
    aiMetrics,
    providerMetrics,
    telegramClient,
    vacancyAnalysisQueue,
    aiBatchBacklog,
    searchRunTraces,
  };
}

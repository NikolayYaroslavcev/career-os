import type { Config } from '@careeros/shared';
import {
  PrismaVacancyRepository,
  PrismaSearchProfileRepository,
  PrismaResumeRepository,
  PrismaMatchResultRepository,
  PrismaCompanyRepository,
  PrismaApplicationRepository,
  PrismaFollowUpRepository,
  PrismaTelegramConnectionRepository,
} from '@careeros/database';
import {
  MatchingEngine,
  VacancyAnalysisPromptBuilder,
  InMemoryAICache,
  InMemoryCostTracker,
  ConsoleAILogger,
  InMemoryAIMetricsCollector,
  InMemoryAITracer,
  createPrimaryAIProviderFromEnv,
  type AIProvider,
} from '@careeros/ai';
import { ConsoleLogger, InMemoryMetricsCollector } from '@careeros/providers';
import { TelegramAdapter, InMemoryTelegramClient, type TelegramClient } from '@careeros/telegram';
import { FollowUpReminderService } from '@careeros/notifications';

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
  };
  readonly matchingEngine: MatchingEngine;
  readonly followUpReminderService: FollowUpReminderService;
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

export function buildWorkerContainer(config: Config): WorkerContainer {
  const vacancyRepository = new PrismaVacancyRepository();
  const searchProfileRepository = new PrismaSearchProfileRepository();
  const resumeRepository = new PrismaResumeRepository();
  const matchResultRepository = new PrismaMatchResultRepository();
  const companyRepository = new PrismaCompanyRepository();
  const applicationRepository = new PrismaApplicationRepository();
  const followUpRepository = new PrismaFollowUpRepository();
  const telegramConnectionRepository = new PrismaTelegramConnectionRepository();

  const aiProvider = createAIProvider(config);

  const matchingEngine = new MatchingEngine({
    provider: aiProvider,
    promptBuilder: new VacancyAnalysisPromptBuilder(),
    cache: new InMemoryAICache(),
    costTracker: new InMemoryCostTracker(),
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
    metrics: new InMemoryAIMetricsCollector(),
    tracer: new InMemoryAITracer(),
  });

  const followUpReminderService = new FollowUpReminderService(
    followUpRepository,
    applicationRepository,
    telegramConnectionRepository,
    createTelegramClient(config),
    new InMemoryMetricsCollector(),
    new ConsoleLogger(config.LOG_LEVEL)
  );

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
    },
    matchingEngine,
    followUpReminderService,
  };
}

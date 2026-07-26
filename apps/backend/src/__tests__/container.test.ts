import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@careeros/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@careeros/ai')>();
  return {
    ...actual,
    createPrimaryAIProviderFromEnv: vi.fn().mockImplementation((config: { AI_PROVIDER?: string }) => ({
      name: config.AI_PROVIDER ?? 'openai',
      complete: vi.fn(),
    })),
    createAIProviderFromConfig: vi.fn().mockImplementation((input: { provider: string; config: unknown }) => ({
      name: input.provider,
      config: input.config,
      complete: vi.fn(),
    })),
    MatchingEngine: vi.fn().mockImplementation(() => ({ match: vi.fn() })),
    VacancyAnalysisPromptBuilder: vi.fn(),
    StructuredResumeExtractionPromptBuilder: vi.fn(),
    ResumeExtractionEngine: vi.fn().mockImplementation(() => ({ extract: vi.fn() })),
    InMemoryAICache: vi.fn(),
    InMemoryCostTracker: vi.fn(),
    ConsoleAILogger: vi.fn(),
    InMemoryAIMetricsCollector: vi.fn(),
    InMemoryAITracer: vi.fn(),
  };
});

vi.mock('@careeros/database', () => ({
  PrismaUserRepository: vi.fn(),
  PrismaResumeRepository: vi.fn(),
  PrismaVacancyRepository: vi.fn(),
  PrismaVacancySourceRepository: vi.fn(),
  PrismaCompanyRepository: vi.fn(),
  PrismaApplicationRepository: vi.fn(),
  PrismaRecruiterRepository: vi.fn(),
  PrismaCommunicationRepository: vi.fn(),
  PrismaInterviewRepository: vi.fn(),
  PrismaFollowUpRepository: vi.fn(),
  PrismaSearchProfileRepository: vi.fn(),
  PrismaMatchResultRepository: vi.fn(),
  PrismaNotificationHistoryRepository: vi.fn(),
  PrismaTelegramConnectionRepository: vi.fn(),
  PrismaTelegramLinkingTokenRepository: vi.fn(),
  PrismaWorkspaceRepository: vi.fn(),
  PrismaRefreshTokenRepository: vi.fn(),
  PrismaStructuredResumeRepository: vi.fn(),
  PrismaCompanyWatchRepository: vi.fn(),
  PrismaCompanyWatchEventRepository: vi.fn(),
  PrismaCompanyWatchSyncLogRepository: vi.fn(),
  PrismaAIJobRepository: vi.fn(),
  PrismaAICacheRepository: vi.fn(),
  PrismaAIUsageRepository: vi.fn(),
  PrismaAIProviderConfigRepository: vi.fn(),
  PrismaAIBudgetRepository: vi.fn(),
  PrismaAnalyticsEventRepository: vi.fn(),
  PrismaCareerInsightRepository: vi.fn(),
  PrismaProviderConfigRepository: vi.fn(),
  PrismaTelegramChannelRepository: vi.fn(),
  PrismaQualityDataRepository: vi.fn(),
  PrismaUserVacancyInteractionRepository: vi.fn(),
}));

vi.mock('@careeros/auth', () => ({
  createAuthProvider: vi.fn().mockReturnValue({}),
}));

vi.mock('@careeros/career', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@careeros/career')>();
  return {
    ...actual,
    ApplicationServiceImpl: vi.fn(),
  };
});

vi.mock('@careeros/company-watch', () => ({
  CompanyWatchService: vi.fn(),
  AtsAdapterRegistry: vi.fn(),
}));

vi.mock('@careeros/ai-orchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@careeros/ai-orchestrator')>();
  return {
    ...actual,
    AIOrchestrator: vi.fn(),
  };
});

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ addBulk: vi.fn(), close: vi.fn() })),
}));

vi.mock('@careeros/telegram', () => ({
  InMemoryTelegramClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
  TelegramAdapter: vi.fn(),
}));

vi.mock('@careeros/providers', () => ({
  ProviderRegistry: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
  })),
  createRemoteOKProvider: vi.fn(),
  createHHProvider: vi.fn(),
  createGreenhouseProvider: vi.fn(),
  createLeverProvider: vi.fn(),
  createAshbyProvider: vi.fn(),
  createWorkdayProvider: vi.fn(),
  createTeamtailorProvider: vi.fn(),
  createRemotiveProvider: vi.fn(),
  createHimalayasProvider: vi.fn(),
  createArbeitnowProvider: vi.fn(),
  createJobicyProvider: vi.fn(),
  createWWRProvider: vi.fn(),
  createWorkingNomadsProvider: vi.fn(),
  createNoDeskProvider: vi.fn(),
  createHNHiringProvider: vi.fn(),
  createLinkedInProvider: vi.fn(),
  createHabrCareerProvider: vi.fn(),
  createAdzunaProvider: vi.fn(),
  createSmartRecruitersProvider: vi.fn(),
  createRecruiteeProvider: vi.fn(),
  createComeetProvider: vi.fn(),
  createSuperJobProvider: vi.fn(),
  createTelegramProvider: vi.fn(),
  ConsoleLogger: vi.fn().mockImplementation(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  InMemoryMetricsCollector: vi.fn(),
  InMemoryTracer: vi.fn(),
  ProviderHealthMonitor: vi.fn().mockImplementation(() => ({
    getStatus: vi.fn(),
    getAllStatuses: vi.fn().mockReturnValue([]),
  })),
}));

const mockConfig = {
  NODE_ENV: 'test' as const,
  PORT: 3000,
  HOST: '0.0.0.0',
  LOG_LEVEL: 'info' as const,
  CORS_ORIGIN: 'http://localhost:3000',
  WORKER_HEALTH_PORT: 3002,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: 9000,
  MINIO_ACCESS_KEY: 'minioadmin',
  MINIO_SECRET_KEY: 'minioadmin',
  MINIO_BUCKET: 'careeros',
  MINIO_USE_SSL: false,
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  EMAIL_FROM: 'CareerOS <noreply@careeros.local>',
  JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  ARGON2_MEMORY_COST: 65536,
  ARGON2_TIME_COST: 3,
  ARGON2_PARALLELISM: 4,
  AI_ENABLED: true,
  AI_PROVIDER: 'openai',
  AI_MAX_CANDIDATES: 15,
  AI_MATCHING_CONCURRENCY: 5,
  AI_BATCH_SIZE: 15,
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  GROQ_API_KEY: '',
  GROQ_SUGGESTION_MODEL: 'llama-3.1-8b-instant',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_WEBHOOK_URL: '',
  PROVIDER_SEARCH_LIMIT: 50,
  PROVIDER_TIMEOUT_MS: 15_000,
  MIN_RELEVANCE_SCORE: 1,
  WORKER_CONCURRENCY: 5,
  DIAGNOSTICS_ENABLED: false,
  AI_ORCHESTRATOR_MODE: 'manual' as const,
  AI_CACHE_TTL_MS: 86_400_000,
  AI_BUDGET_CHECK_ENABLED: true,
  AI_MIN_TRIAGE_SCORE: 2,
  HH_AREAS: '113',
  ADZUNA_COUNTRY: 'gb',
};

describe('Container AI Provider Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates primary AI provider construction to the single shared factory, unmodified', async () => {
    // Dynamic import of the full container/AI module graph is fast in
    // isolation but can push past vitest's default 5s test timeout when the
    // whole monorepo test suite runs in parallel and module transform is
    // contended — this is about CI scheduling, not the assertion itself.
    const { createPrimaryAIProviderFromEnv } = await import('@careeros/ai');
    const { buildContainer } = await import('../container.js');

    const config = { ...mockConfig, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test' };
    buildContainer(config);

    // apps/backend no longer resolves provider name/API key itself — it hands
    // the whole config to packages/ai's createPrimaryAIProviderFromEnv, the
    // one place that owns that mapping (also used by apps/worker), plus a
    // logger/metrics collector for the resilience wrapper to report through.
    expect(createPrimaryAIProviderFromEnv).toHaveBeenCalledTimes(1);
    const [calledConfig, deps] = (createPrimaryAIProviderFromEnv as unknown as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(calledConfig).toBe(config);
    expect(deps).toEqual(
      expect.objectContaining({ logger: expect.anything(), metrics: expect.anything() })
    );
  }, 15_000);

  it('pins a separate, cheaper Groq model for search profile suggestion, distinct from vacancy matching', async () => {
    const { createAIProviderFromConfig } = await import('@careeros/ai');
    const { buildContainer } = await import('../container.js');

    const config = {
      ...mockConfig,
      AI_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk-test',
      GROQ_SUGGESTION_MODEL: 'llama-3.1-8b-instant',
    };
    buildContainer(config);

    // Search profile suggestion pins the cheaper, separately configured model
    // via the shared low-level factory — vacancy matching's provider (built by
    // createPrimaryAIProviderFromEnv, asserted separately) keeps the default.
    expect(createAIProviderFromConfig).toHaveBeenCalledWith({
      provider: 'groq',
      config: { apiKey: 'gsk-test', model: 'llama-3.1-8b-instant' },
    });
    expect(createAIProviderFromConfig).toHaveBeenCalledTimes(1);
  });

  it('reuses the single AI provider for search profile suggestion on non-Groq providers', async () => {
    const { createAIProviderFromConfig } = await import('@careeros/ai');
    const { buildContainer } = await import('../container.js');

    const config = { ...mockConfig, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' };
    buildContainer(config);

    expect(createAIProviderFromConfig).not.toHaveBeenCalled();
  });
});

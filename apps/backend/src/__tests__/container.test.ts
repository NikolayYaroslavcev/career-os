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
}));

vi.mock('@careeros/auth', () => ({
  createAuthProvider: vi.fn().mockReturnValue({}),
}));

vi.mock('@careeros/career', () => ({
  ApplicationServiceImpl: vi.fn(),
  ExperienceLevel: {
    INTERN: 'intern',
    JUNIOR: 'junior',
    MIDDLE: 'middle',
    SENIOR: 'senior',
    LEAD: 'lead',
    PRINCIPAL: 'principal',
    EXECUTIVE: 'executive',
  },
}));

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
  ConsoleLogger: vi.fn().mockImplementation(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  InMemoryMetricsCollector: vi.fn(),
  InMemoryTracer: vi.fn(),
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
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  GROQ_API_KEY: '',
  GROQ_SUGGESTION_MODEL: 'llama-3.1-8b-instant',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_WEBHOOK_URL: '',
};

describe('Container AI Provider Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates primary AI provider construction to the single shared factory, unmodified', async () => {
    const { createPrimaryAIProviderFromEnv } = await import('@careeros/ai');
    const { buildContainer } = await import('../container.js');

    const config = { ...mockConfig, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test' };
    buildContainer(config);

    // apps/backend no longer resolves provider name/API key itself — it hands
    // the whole config to packages/ai's createPrimaryAIProviderFromEnv, the
    // one place that owns that mapping (also used by apps/worker), plus a
    // logger/metrics collector for the resilience wrapper to report through.
    expect(createPrimaryAIProviderFromEnv).toHaveBeenCalledTimes(1);
    const [calledConfig, deps] = (createPrimaryAIProviderFromEnv as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(calledConfig).toBe(config);
    expect(deps).toEqual(
      expect.objectContaining({ logger: expect.anything(), metrics: expect.anything() })
    );
  });

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

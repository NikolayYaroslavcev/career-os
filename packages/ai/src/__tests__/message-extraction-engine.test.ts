import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { SocialMessage, createSocialMessageId, SocialPlatform, TransportType } from '@careeros/career';
import { MessageExtractionEngine, type MessageExtractionEngineDeps } from '../extraction/message-extraction-engine.js';
import { MessageExtractionPromptBuilder } from '../prompts/message-extraction.js';
import { MessageExtractionStatus, type MessageExtraction } from '../domain/message-extraction.js';
import type { MessageExtractionRepository } from '../domain/message-extraction-repository.js';
import { InMemoryAICache } from '../cache/ai-cache.js';
import { InMemoryCostTracker } from '../cost/cost-tracker-impl.js';
import { NoopAILogger } from '../observability/ai-logger.js';
import { InMemoryAIMetricsCollector } from '../observability/ai-metrics.js';
import { InMemoryAITracer } from '../observability/ai-tracer.js';
import { BaseAIProvider } from '../providers/base-provider.js';
import { FallbackAIProvider } from '../providers/fallback-ai-provider.js';
import { AIRetryPolicy } from '../resilience/retry-policy.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import type { AIRequest, AIResponse, AICapabilities } from '../domain/ai-types.js';
import type { AIProvider, AIProviderConfig } from '../domain/ai-provider.js';

class MockProvider extends BaseAIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';
  private responseQueue: Array<Record<string, unknown> | 'malformed' | Error> = [];
  callCount = 0;
  lastRequest: AIRequest | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
  }

  queueResponse(data: Record<string, unknown> | 'malformed' | Error): void {
    this.responseQueue.push(data);
  }

  getCapabilities(): AICapabilities {
    return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
  }

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    this.callCount++;
    this.lastRequest = request;

    const next = this.responseQueue.shift();
    if (next instanceof Error) throw next;

    const content = next === 'malformed' || next === undefined ? 'not json at all {' : JSON.stringify(next);

    return {
      content,
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      model: 'mock-model',
      confidence: 0.9,
      requestId: crypto.randomUUID(),
    };
  }
}

class InMemoryMessageExtractionRepository implements MessageExtractionRepository {
  readonly rows: MessageExtraction[] = [];

  async save(extraction: MessageExtraction): Promise<MessageExtraction> {
    this.rows.push(extraction);
    return extraction;
  }

  async findById(id: string): Promise<MessageExtraction | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async findByMessageId(messageId: string): Promise<readonly MessageExtraction[]> {
    return this.rows.filter((r) => r.messageId === messageId);
  }

  async findLatestByMessageId(messageId: string): Promise<MessageExtraction | null> {
    return this.rows.filter((r) => r.messageId === messageId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
  }

  async findByContentHashAndPrompt(
    contentHash: string,
    provider: string,
    model: string,
    promptChecksum: string,
  ): Promise<MessageExtraction | null> {
    return (
      this.rows.find(
        (r) => r.contentHash === contentHash && r.provider === provider && r.model === model && r.promptChecksum === promptChecksum,
      ) ?? null
    );
  }
}

function createTestMessage(rawText: string): SocialMessage {
  return SocialMessage.create({
    id: createSocialMessageId(crypto.randomUUID()),
    platform: SocialPlatform.TELEGRAM,
    sourceId: 'testchannel',
    externalMessageId: '123',
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    rawText,
    contentHash: createHash('sha256').update(rawText).digest('hex'),
    transport: TransportType.HTML_PREVIEW,
  });
}

const VALID_EXTRACTION_DATA = {
  company: 'Acme Corp',
  title: 'Senior Backend Engineer',
  technologies: ['Node.js', 'PostgreSQL'],
  skills: [],
  seniority: 'senior',
  salaryMin: 120000,
  salaryMax: 150000,
  currency: 'USD',
  country: 'Germany',
  city: null,
  employmentType: 'full-time',
  remoteType: 'remote',
  contact: null,
  recruiter: null,
  links: [],
  atsKeywords: [],
  responsibilities: ['Build backend services'],
  requirements: ['5+ years of experience'],
  category: 'backend',
  evidence: {
    title: 'Senior Backend Engineer',
    company: 'Acme Corp',
    country: 'Germany',
    employmentType: 'full-time',
    remoteType: 'remote',
  },
  confidence: 0.95,
};

const RAW_TEXT = 'Senior Backend Engineer at Acme Corp. Remote, full-time. Country: Germany. 5+ years of experience. $120k-$150k.';

function createDeps(provider: MockProvider, repository: MessageExtractionRepository): MessageExtractionEngineDeps {
  return {
    provider,
    promptBuilder: new MessageExtractionPromptBuilder(),
    repository,
    cache: new InMemoryAICache(),
    costTracker: new InMemoryCostTracker(),
    logger: new NoopAILogger(),
    metrics: new InMemoryAIMetricsCollector(),
    tracer: new InMemoryAITracer(),
  };
}

describe('MessageExtractionEngine', () => {
  let provider: MockProvider;
  let repository: InMemoryMessageExtractionRepository;

  beforeEach(() => {
    provider = new MockProvider({ apiKey: 'test' });
    repository = new InMemoryMessageExtractionRepository();
  });

  it('extracts, validates, scores, and persists a successful response', async () => {
    provider.queueResponse(VALID_EXTRACTION_DATA);
    const engine = new MessageExtractionEngine(createDeps(provider, repository), { enableCache: false });

    const { extraction, reused } = await engine.extract(createTestMessage(RAW_TEXT));

    expect(reused).toBe(false);
    expect(extraction.status).toBe(MessageExtractionStatus.SUCCESS);
    expect(extraction.extractedFields.company).toBe('Acme Corp');
    expect(extraction.extractedFields.title).toBe('Senior Backend Engineer');
    expect(extraction.deterministicConfidence).toBeGreaterThan(0);
    expect(extraction.aiSelfReportedConfidence).toBe(0.95);
    expect(extraction.fromCache).toBe(false);
    expect(repository.rows).toHaveLength(1);
    expect(repository.rows[0]).toBe(extraction);
  });

  it('never persists a fabricated/invalid payload — retries then records a PARSE_ERROR row with defaulted fields', async () => {
    provider.queueResponse('malformed');
    provider.queueResponse('malformed');
    provider.queueResponse('malformed');
    const engine = new MessageExtractionEngine(createDeps(provider, repository), { enableCache: false, maxRetries: 2, retryBaseDelayMs: 1, retryMaxDelayMs: 5 });

    const { extraction } = await engine.extract(createTestMessage(RAW_TEXT));

    expect(provider.callCount).toBe(3);
    expect(extraction.status).toBe(MessageExtractionStatus.PARSE_ERROR);
    expect(extraction.extractedFields.title).toBeNull();
    expect(extraction.extractedFields.company).toBeNull();
    expect(extraction.deterministicConfidence).toBe(0);
    expect(extraction.errorMessage).toBeTruthy();
    expect(repository.rows).toHaveLength(1);
  });

  it('recovers on retry when the first response is invalid but a later one validates', async () => {
    provider.queueResponse('malformed');
    provider.queueResponse(VALID_EXTRACTION_DATA);
    const engine = new MessageExtractionEngine(createDeps(provider, repository), { enableCache: false, maxRetries: 2, retryBaseDelayMs: 1, retryMaxDelayMs: 5 });

    const { extraction } = await engine.extract(createTestMessage(RAW_TEXT));

    expect(provider.callCount).toBe(2);
    expect(extraction.status).toBe(MessageExtractionStatus.SUCCESS);
    expect(extraction.extractedFields.company).toBe('Acme Corp');
  });

  it('records a PROVIDER_ERROR row (not thrown) after exhausting retries on transient failures', async () => {
    provider.queueResponse(new AIError({ type: AIErrorType.RATE_LIMITED, message: 'rate limited', provider: 'mock' }));
    provider.queueResponse(new AIError({ type: AIErrorType.RATE_LIMITED, message: 'rate limited', provider: 'mock' }));
    const engine = new MessageExtractionEngine(createDeps(provider, repository), { enableCache: false, maxRetries: 1, retryBaseDelayMs: 1, retryMaxDelayMs: 5 });

    const { extraction } = await engine.extract(createTestMessage(RAW_TEXT));

    expect(provider.callCount).toBe(2);
    expect(extraction.status).toBe(MessageExtractionStatus.PROVIDER_ERROR);
    expect(extraction.tokenUsage.totalTokens).toBe(0);
    expect(repository.rows).toHaveLength(1);
  });

  it('does not retry on a non-retryable provider error', async () => {
    provider.queueResponse(new AIError({ type: AIErrorType.AUTHENTICATION_ERROR, message: 'bad key', provider: 'mock', retryable: false }));
    const engine = new MessageExtractionEngine(createDeps(provider, repository), { enableCache: false, maxRetries: 2 });

    const { extraction } = await engine.extract(createTestMessage(RAW_TEXT));

    expect(provider.callCount).toBe(1);
    expect(extraction.status).toBe(MessageExtractionStatus.PROVIDER_ERROR);
  });

  it('reuses a cached validated response without a second provider call', async () => {
    provider.queueResponse(VALID_EXTRACTION_DATA);
    const deps = createDeps(provider, repository);
    const engine = new MessageExtractionEngine(deps, { enableCache: true });

    const message = createTestMessage(RAW_TEXT);
    await engine.extract(message);
    expect(repository.rows).toHaveLength(1);

    // Second message, identical content/provider/model/prompt but a different
    // repository row (simulates content re-appearing under a new SocialMessage
    // id) — should hit the AICache instead of calling the provider again.
    const secondRepository = new InMemoryMessageExtractionRepository();
    const engine2 = new MessageExtractionEngine({ ...deps, repository: secondRepository }, { enableCache: true });
    const secondMessage = createTestMessage(RAW_TEXT);
    const { extraction } = await engine2.extract(secondMessage);

    expect(provider.callCount).toBe(1);
    expect(extraction.fromCache).toBe(true);
    expect(extraction.extractedFields.company).toBe('Acme Corp');
  });

  it('is idempotent: extracting the same message twice reuses the existing row and skips the AI call', async () => {
    provider.queueResponse(VALID_EXTRACTION_DATA);
    const engine = new MessageExtractionEngine(createDeps(provider, repository), { enableCache: false });
    const message = createTestMessage(RAW_TEXT);

    const first = await engine.extract(message);
    const second = await engine.extract(message);

    expect(provider.callCount).toBe(1);
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.extraction.id).toBe(first.extraction.id);
    expect(repository.rows).toHaveLength(1);
  });

  it('classifies a message with no job signal as SPAM', async () => {
    provider.queueResponse({ ...VALID_EXTRACTION_DATA, company: null, title: null, technologies: [], requirements: [], responsibilities: [], evidence: {} });
    const engine = new MessageExtractionEngine(createDeps(provider, repository), { enableCache: false });

    const { extraction } = await engine.extract(createTestMessage('just some unrelated chatter'));

    expect(extraction.status).toBe(MessageExtractionStatus.SPAM);
  });

  // Regression guard for the Telegram AI-extraction outage (root cause: the
  // request built here pinned `model` to the primary provider's defaultModel,
  // and FallbackAIProvider forwards that same request object to every
  // provider in the chain unchanged — so a Groq model id reached OpenRouter/
  // DeepSeek, who rejected it as invalid. matching-engine.ts already avoids
  // this by leaving `model` unset; this test guards the same fix here.
  it('does not leak the primary provider default model into a fallback provider request', async () => {
    const primaryDefaultModel = 'llama-3.3-70b-versatile';
    const rateLimitError = new AIError({
      type: AIErrorType.RATE_LIMITED,
      message: 'rate limited',
      provider: 'groq',
      retryable: true,
    });

    const primary: AIProvider & { complete: ReturnType<typeof vi.fn> } = {
      name: 'groq',
      defaultModel: primaryDefaultModel,
      complete: vi.fn().mockRejectedValue(rateLimitError),
      getCapabilities: vi.fn((): AICapabilities => ({ supportsStreaming: false, supportsVision: false, maxTokens: 4000, supportedModels: [] })),
      validateConfig: vi.fn(() => true),
    };

    let secondaryReceivedRequest: AIRequest | undefined;
    const secondary: AIProvider & { complete: ReturnType<typeof vi.fn> } = {
      name: 'openrouter',
      defaultModel: 'openai/gpt-4o',
      complete: vi.fn(async (request: AIRequest): Promise<AIResponse> => {
        secondaryReceivedRequest = request;
        return {
          content: JSON.stringify(VALID_EXTRACTION_DATA),
          usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          model: 'openai/gpt-4o',
          provider: 'openrouter',
          latencyMs: 5,
          confidence: 0.9,
          requestId: 'req-2',
        };
      }),
      getCapabilities: vi.fn((): AICapabilities => ({ supportsStreaming: false, supportsVision: false, maxTokens: 4000, supportedModels: [] })),
      validateConfig: vi.fn(() => true),
    };

    const fallbackProvider = new FallbackAIProvider([primary, secondary], {
      retryPolicy: new AIRetryPolicy({ maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false }),
    });

    const deps: MessageExtractionEngineDeps = {
      provider: fallbackProvider,
      promptBuilder: new MessageExtractionPromptBuilder(),
      repository,
      cache: new InMemoryAICache(),
      costTracker: new InMemoryCostTracker(),
      logger: new NoopAILogger(),
      metrics: new InMemoryAIMetricsCollector(),
      tracer: new InMemoryAITracer(),
    };
    const engine = new MessageExtractionEngine(deps, { enableCache: false });

    const { extraction } = await engine.extract(createTestMessage(RAW_TEXT));

    expect(secondary.complete).toHaveBeenCalledTimes(1);
    expect(secondaryReceivedRequest?.model).not.toBe(primaryDefaultModel);
    expect(extraction.status).toBe(MessageExtractionStatus.SUCCESS);
  });

  // Regression guard for the Telegram frontend/backend extraction-asymmetry
  // investigation: a realistic, detail-rich frontend posting must have its
  // real technologies (React/TypeScript/Next.js) come through unchanged —
  // proving the pipeline doesn't drop them — while a thin, tech-free posting
  // (see the next test) correctly yields an empty array rather than a
  // fabricated one. Both behaviors are content-driven, not category-driven.
  it('extracts React/TypeScript/Next.js from a realistic frontend vacancy that actually mentions them', async () => {
    const frontendRawText =
      'Middle/Senior Frontend-разработчик (команда роста)\n' +
      'Компания: Rocket Sci. Remote.\n' +
      'Требования:\n' +
      '-опыт коммерческой разработки на React от 2 лет\n' +
      '-уверенное владение TypeScript\n' +
      '-опыт работы с Next.js будет плюсом\n' +
      'Зарплата: 250000-350000 RUB';

    provider.queueResponse({
      ...VALID_EXTRACTION_DATA,
      title: 'Middle/Senior Frontend-разработчик',
      technologies: ['React', 'TypeScript', 'Next.js'],
      category: 'frontend',
      salaryMin: 250000,
      salaryMax: 350000,
      currency: 'RUB',
      evidence: {
        title: 'Middle/Senior Frontend-разработчик (команда роста)',
        company: 'Rocket Sci',
        remoteType: 'Remote',
      },
    });
    const engine = new MessageExtractionEngine(createDeps(provider, repository), { enableCache: false });

    const { extraction } = await engine.extract(createTestMessage(frontendRawText));

    expect(extraction.status).toBe(MessageExtractionStatus.SUCCESS);
    expect(extraction.extractedFields.technologies).toEqual(['React', 'TypeScript', 'Next.js']);
  });

  it('does not fabricate technologies for a thin posting that names none', async () => {
    const thinRawText = 'Senior Frontend Developer\nWebito is a commerce platform. Germany (Munich). Remote work.\nJob description on LinkedIn.';

    provider.queueResponse({
      ...VALID_EXTRACTION_DATA,
      title: 'Senior Frontend Developer',
      technologies: [],
      category: 'frontend',
      salaryMin: null,
      salaryMax: null,
      currency: null,
      evidence: {
        title: 'Senior Frontend Developer',
        country: 'Germany',
        remoteType: 'Remote',
      },
    });
    const engine = new MessageExtractionEngine(createDeps(provider, repository), { enableCache: false });

    const { extraction } = await engine.extract(createTestMessage(thinRawText));

    expect(extraction.status).toBe(MessageExtractionStatus.SUCCESS);
    expect(extraction.extractedFields.technologies).toEqual([]);
  });
});

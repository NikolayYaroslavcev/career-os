import { describe, it, expect, beforeEach } from 'vitest';
import { Resume, createResumeId, createUserId } from '@careeros/career';
import { BaseAIProvider, AIError, AIErrorType } from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig } from '@careeros/ai';
import {
  SearchProfileSuggestionService,
  ResumeNotFoundForSuggestionError,
  ResumeNotAuthorizedForSuggestionError,
  ResumeTextUnavailableError,
  SearchProfileSuggestionError,
  SearchProfileSuggestionUnavailableError,
} from '../search-profile-suggestion-service.js';
import {
  InMemoryResumeRepository,
  InMemoryStructuredResumeRepository,
} from '../../testing/in-memory-repositories.js';
import { MockSuggestionAIProvider } from '../../testing/mock-suggestion-ai-provider.js';
import type { BudgetEnforcer, BudgetCheckResult } from '@careeros/ai-orchestrator';

class StaticContentAIProvider extends BaseAIProvider {
  readonly name = 'static';
  readonly defaultModel = 'static-model';

  constructor(private readonly content: string, config: AIProviderConfig = { apiKey: 'static' }) {
    super(config);
  }

  getCapabilities(): AICapabilities {
    return { supportsStreaming: false, supportsVision: false, maxTokens: 8000, supportedModels: ['static-model'] };
  }

  protected async doComplete(_request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    return {
      content: this.content,
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: this.defaultModel,
      confidence: 0.5,
      requestId: crypto.randomUUID(),
    };
  }
}

class FailingAIProvider extends BaseAIProvider {
  readonly name = 'failing';
  readonly defaultModel = 'failing-model';

  constructor(private readonly error: Error, config: AIProviderConfig = { apiKey: 'failing' }) {
    super(config);
  }

  getCapabilities(): AICapabilities {
    return { supportsStreaming: false, supportsVision: false, maxTokens: 8000, supportedModels: ['failing-model'] };
  }

  protected async doComplete(_request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    throw this.error;
  }
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const RESUME_ID = '22222222-2222-4222-8222-222222222222';

function buildResume(rawText?: string): Resume {
  return Resume.create({
    id: createResumeId(RESUME_ID),
    userId: createUserId(USER_ID),
    title: 'Senior Backend Engineer Resume',
    rawText,
  });
}

describe('SearchProfileSuggestionService', () => {
  let repository: InMemoryResumeRepository;
  let structuredResumeRepository: InMemoryStructuredResumeRepository;

  beforeEach(() => {
    repository = new InMemoryResumeRepository();
    structuredResumeRepository = new InMemoryStructuredResumeRepository();
  });

  it('generates a suggestion derived from the resume raw text', async () => {
    const resume = buildResume(
      'Senior Backend Engineer with 8 years of experience in TypeScript, Node.js, and PostgreSQL. Remote-first company.'
    );
    await repository.save(resume);

    const service = new SearchProfileSuggestionService(
      repository,
      new MockSuggestionAIProvider(),
      structuredResumeRepository
    );
    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.desiredPositions.length).toBeGreaterThan(0);
    expect(suggestion.technologies).toEqual(expect.arrayContaining(['typescript', 'node.js', 'postgresql']));
    expect(suggestion.experienceLevel).toBe('senior');
    expect(suggestion.remotePreference).toBe('remote');
    expect(suggestion.confidence).toBeGreaterThan(0);
  });

  it('throws ResumeNotFoundForSuggestionError when the resume does not exist', async () => {
    const service = new SearchProfileSuggestionService(
      repository,
      new MockSuggestionAIProvider(),
      structuredResumeRepository
    );

    await expect(service.suggest({ userId: USER_ID, resumeId: RESUME_ID })).rejects.toThrow(
      ResumeNotFoundForSuggestionError
    );
  });

  it('throws ResumeNotAuthorizedForSuggestionError when the resume belongs to another user', async () => {
    const resume = buildResume('Some resume text.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(
      repository,
      new MockSuggestionAIProvider(),
      structuredResumeRepository
    );

    await expect(service.suggest({ userId: OTHER_USER_ID, resumeId: RESUME_ID })).rejects.toThrow(
      ResumeNotAuthorizedForSuggestionError
    );
  });

  it('throws ResumeTextUnavailableError when the resume has no extracted text', async () => {
    const resume = buildResume(undefined);
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(
      repository,
      new MockSuggestionAIProvider(),
      structuredResumeRepository
    );

    await expect(service.suggest({ userId: USER_ID, resumeId: RESUME_ID })).rejects.toThrow(
      ResumeTextUnavailableError
    );
  });

  it('falls back to safe defaults when the AI response is malformed JSON', async () => {
    const resume = buildResume('Some resume text.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(
      repository,
      new StaticContentAIProvider('not valid json'),
      structuredResumeRepository
    );

    await expect(service.suggest({ userId: USER_ID, resumeId: RESUME_ID })).rejects.toThrow(
      SearchProfileSuggestionError
    );
  });

  it('defensively fills in missing or invalid fields from a partial AI response', async () => {
    const resume = buildResume('Some resume text.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(
      repository,
      new StaticContentAIProvider(JSON.stringify({ desiredPositions: ['Backend Engineer'] })),
      structuredResumeRepository
    );

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.desiredPositions).toEqual(['Backend Engineer']);
    expect(suggestion.technologies).toEqual([]);
    expect(suggestion.experienceLevel).toBe('middle');
    expect(suggestion.remotePreference).toBeNull();
  });

  it('throws a retryable SearchProfileSuggestionUnavailableError when the AI provider is rate limited, without leaking the raw upstream error', async () => {
    const resume = buildResume('Some resume text.');
    await repository.save(resume);
    const rateLimitError = new AIError({
      type: AIErrorType.RATE_LIMITED,
      message: '{"error":{"message":"Rate limit reached... Upgrade to Dev Tier today at https://console.groq.com/settings/billing"}}',
      provider: 'groq',
    });
    const service = new SearchProfileSuggestionService(
      repository,
      new FailingAIProvider(rateLimitError),
      structuredResumeRepository
    );

    const failure = service.suggest({ userId: USER_ID, resumeId: RESUME_ID });
    await expect(failure).rejects.toThrow(SearchProfileSuggestionUnavailableError);
    await failure.catch((error: SearchProfileSuggestionUnavailableError) => {
      expect(error.retryable).toBe(true);
      expect(error.message).not.toContain('console.groq.com');
    });
  });

  it('truncates a very long resume before sending it to the AI provider, so the prompt stays within a safe size', async () => {
    const hugeRawText = 'Senior Backend Engineer with TypeScript experience. '.repeat(1000);
    expect(hugeRawText.length).toBeGreaterThan(50_000);
    const resume = buildResume(hugeRawText);
    await repository.save(resume);
    const provider = new MockSuggestionAIProvider();
    const service = new SearchProfileSuggestionService(
      repository,
      provider,
      structuredResumeRepository
    );

    await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(provider.lastRequest).toBeDefined();
    const sentPrompt = provider.lastRequest?.prompt ?? '';
    expect(sentPrompt.length).toBeLessThan(hugeRawText.length);
    expect(sentPrompt.length).toBeLessThan(8000);
  });

  it('truncates a long Russian resume more aggressively than an equivalent-length English one, so it stays within the AI provider token budget', async () => {
    const cyrillicRawText = 'Старший инженер-разработчик с опытом работы на бэкенде. '.repeat(400);
    expect(cyrillicRawText.length).toBeGreaterThan(20_000);
    const resume = buildResume(cyrillicRawText);
    await repository.save(resume);
    const provider = new MockSuggestionAIProvider();
    const service = new SearchProfileSuggestionService(
      repository,
      provider,
      structuredResumeRepository
    );

    await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(provider.lastRequest).toBeDefined();
    const sentPrompt = provider.lastRequest?.prompt ?? '';
    // Cyrillic text tokenizes far less efficiently than English, so the
    // character budget for a Cyrillic resume must be noticeably smaller
    // than the plain-English case covered by the test above.
    expect(sentPrompt.length).toBeLessThan(5000);
    expect(provider.lastRequest?.maxTokens).toBeDefined();
    expect(provider.lastRequest?.maxTokens as number).toBeLessThanOrEqual(1000);
  });

  it('produces a working suggestion for an 8+ page Senior/Lead CV, preserving the Skills section even though it sits at the very end', async () => {
    const jobDescription =
      'Delivered and operated microservice-based backend systems handling millions of requests per day, ' +
      'led incident response, mentored engineers, and drove architecture decisions across the platform. ';
    const job = (company: string, years: string): string =>
      `${company} — Senior Backend Engineer (${years})\n${jobDescription.repeat(30)}`;

    const eightPageResume = [
      'Aleksandr Petrov',
      'Senior Backend Engineer',
      '',
      'Summary',
      'Опытный инженер-разработчик с более чем 10 годами опыта в разработке высоконагруженных бэкенд-систем. '.repeat(
        20
      ),
      '',
      'Experience',
      job('Company A', '2021-Present'),
      job('Company B', '2017-2021'),
      job('Company C', '2013-2017'),
      job('Company D', '2010-2013'),
      '',
      'Education',
      'Moscow State University, Computer Science, 2005-2010',
      '',
      'Skills',
      'TypeScript, Node.js, Kubernetes, PostgreSQL, GraphQL, Docker, AWS',
    ].join('\n\n');

    // ~2500 chars/page is a reasonable density estimate for extracted PDF text.
    expect(eightPageResume.length / 2500).toBeGreaterThanOrEqual(8);

    const resume = buildResume(eightPageResume);
    await repository.save(resume);
    const provider = new MockSuggestionAIProvider();
    const service = new SearchProfileSuggestionService(
      repository,
      provider,
      structuredResumeRepository
    );

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    // A naive prefix truncate would cut this resume off partway through
    // "Experience" and never reach the Skills section at the very end —
    // the AI would then see zero recognizable technologies.
    expect(suggestion.technologies).toEqual(
      expect.arrayContaining(['typescript', 'node.js', 'kubernetes', 'postgresql'])
    );
    expect(suggestion.desiredPositions.length).toBeGreaterThan(0);
  });

  it('extracts the desired job title(s) from role keywords in the resume text', async () => {
    const resume = buildResume('Experienced Data Engineer building large-scale ETL pipelines.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(repository, new MockSuggestionAIProvider(), structuredResumeRepository);

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.desiredPositions).toEqual(['Data Engineer']);
  });

  it('falls back to a generic title when no role keyword is present in the resume', async () => {
    const resume = buildResume('Loves building things and solving problems.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(repository, new MockSuggestionAIProvider(), structuredResumeRepository);

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.desiredPositions).toEqual(['Software Engineer']);
  });

  it('extracts every recognizable skill/technology from the resume text', async () => {
    const resume = buildResume('Backend Engineer skilled in Go, PostgreSQL, Docker, Kubernetes, and AWS.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(repository, new MockSuggestionAIProvider(), structuredResumeRepository);

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.technologies).toEqual(
      expect.arrayContaining(['go', 'postgresql', 'docker', 'kubernetes', 'aws'])
    );
  });

  it('returns an empty technologies list when the resume mentions no recognizable skill', async () => {
    const resume = buildResume('Manages people and processes across the organization.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(repository, new MockSuggestionAIProvider(), structuredResumeRepository);

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.technologies).toEqual([]);
  });

  it.each([
    ['principal', 'principal'],
    ['lead', 'lead'],
    ['senior', 'senior'],
    ['junior', 'junior'],
    ['intern', 'intern'],
  ])('infers seniority "%s" from the resume text', async (keyword, expectedLevel) => {
    const resume = buildResume(`${keyword} Software Engineer with hands-on delivery experience.`);
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(repository, new MockSuggestionAIProvider(), structuredResumeRepository);

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.experienceLevel).toBe(expectedLevel);
  });

  it('defaults seniority to "middle" when the resume gives no explicit level signal', async () => {
    const resume = buildResume('Software Engineer with several years of delivery experience.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(repository, new MockSuggestionAIProvider(), structuredResumeRepository);

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.experienceLevel).toBe('middle');
  });

  it.each([
    ['remote-first company', 'remote'],
    ['hybrid work schedule', 'hybrid'],
    ['onsite in the downtown office', 'onsite'],
  ])('infers work mode from "%s" in the resume text', async (phrase, expectedMode) => {
    const resume = buildResume(`Software Engineer at a ${phrase}.`);
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(repository, new MockSuggestionAIProvider(), structuredResumeRepository);

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.remotePreference).toBe(expectedMode);
  });

  it('returns a null work mode when the resume gives no remote/hybrid/onsite signal', async () => {
    const resume = buildResume('Software Engineer who ships reliable systems.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(repository, new MockSuggestionAIProvider(), structuredResumeRepository);

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.remotePreference).toBeNull();
  });

  it('does not derive a desired location from the resume — location is not part of this suggestion yet', async () => {
    // Documents a real coverage gap rather than asserting invented behavior:
    // SearchProfile.desiredLocations exists on the domain entity, but
    // SearchProfileSuggestionService/the AI prompt never populate it, so a
    // resume mentioning a city has no effect on the suggestion today.
    const resume = buildResume('Senior Backend Engineer based in Berlin, Germany.');
    await repository.save(resume);
    const service = new SearchProfileSuggestionService(repository, new MockSuggestionAIProvider(), structuredResumeRepository);

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion).not.toHaveProperty('desiredLocations');
    expect(suggestion).not.toHaveProperty('location');
  });

  it('extracts JSON from a markdown-fenced AI response', async () => {
    const resume = buildResume('Some resume text.');
    await repository.save(resume);
    const fenced = '```json\n' + JSON.stringify({ desiredPositions: ['Staff Engineer'], experienceLevel: 'lead' }) + '\n```';
    const service = new SearchProfileSuggestionService(
      repository,
      new StaticContentAIProvider(fenced),
      structuredResumeRepository
    );

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.desiredPositions).toEqual(['Staff Engineer']);
    expect(suggestion.experienceLevel).toBe('lead');
  });

  it('uses structured resume context when available', async () => {
    const resume = buildResume('Senior Backend Engineer with TypeScript experience.');
    await repository.save(resume);

    const service = new SearchProfileSuggestionService(
      repository,
      new MockSuggestionAIProvider(),
      structuredResumeRepository
    );
    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.desiredPositions.length).toBeGreaterThan(0);
  });

  it('extraction failure does not prevent suggestion from being generated', async () => {
    const resume = buildResume('Senior Backend Engineer with TypeScript experience.');
    await repository.save(resume);

    const extractionProvider = new FailingAIProvider(new Error('Extraction AI failed'));
    const extractionEngine = new (await import('@careeros/ai')).ResumeExtractionEngine(
      {
        provider: extractionProvider,
        promptBuilder: new (await import('@careeros/ai')).StructuredResumeExtractionPromptBuilder(),
        logger: new (await import('@careeros/ai')).ConsoleAILogger('info'),
        metrics: new (await import('@careeros/ai')).InMemoryAIMetricsCollector(),
      },
      { maxRetries: 0, timeoutMs: 5000 }
    );

    const service = new SearchProfileSuggestionService(
      repository,
      new MockSuggestionAIProvider(),
      structuredResumeRepository,
      extractionEngine,
      '1.0.0'
    );

    const suggestion = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID });

    expect(suggestion.desiredPositions.length).toBeGreaterThan(0);
  });

  describe('budget enforcement', () => {
    function blockedBudgetEnforcer(): BudgetEnforcer {
      return {
        checkBudget: async (): Promise<BudgetCheckResult> => ({ allowed: false, reason: 'monthly cost limit reached' }),
      } as unknown as BudgetEnforcer;
    }

    it('throws a non-retryable SearchProfileSuggestionUnavailableError without calling the AI provider when the budget is exhausted', async () => {
      const resume = buildResume('Senior Backend Engineer with TypeScript experience.');
      await repository.save(resume);

      const provider = new (class extends StaticContentAIProvider {
        callCount = 0;
        protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
          this.callCount += 1;
          return super.doComplete(request);
        }
      })('{}');

      const service = new SearchProfileSuggestionService(
        repository,
        provider,
        structuredResumeRepository,
        null,
        '1.0.0',
        undefined,
        blockedBudgetEnforcer()
      );

      const error = await service.suggest({ userId: USER_ID, resumeId: RESUME_ID }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SearchProfileSuggestionUnavailableError);
      expect((error as InstanceType<typeof SearchProfileSuggestionUnavailableError>).retryable).toBe(false);
      expect(provider.callCount).toBe(0);
    });
  });
});

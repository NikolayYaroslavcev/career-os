import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryAICache,
  InMemoryCostTracker,
  NoopAILogger,
  InMemoryAIMetricsCollector,
  InMemoryAITracer,
  BaseAIProvider,
} from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig, MatchResult, MatchResultRepository } from '@careeros/ai';
import { AnalyzeVacancyHandler, type AnalyzeVacancyInput } from '../analyze-vacancy-handler.js';

class CountingProvider extends BaseAIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';
  callCount = 0;

  constructor(config: AIProviderConfig) {
    super(config);
  }

  getCapabilities(): AICapabilities {
    return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
  }

  protected async doComplete(_request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    this.callCount += 1;
    return {
      content: JSON.stringify({
        overallScore: 70,
        confidence: 0.6,
        recommendation: 'Apply',
        summary: 'Decent match.',
        strengths: ['TypeScript'],
        weaknesses: [],
        requiredSkills: ['TypeScript'],
        missingSkills: [],
        seniorityEstimation: 'Middle',
        remotePolicy: 'Remote',
        salaryObservations: null,
        salaryFit: { score: 70, confidence: 0.6, reasoning: '' },
        locationFit: { score: 70, confidence: 0.6, reasoning: '' },
        experienceFit: { score: 70, confidence: 0.6, reasoning: '' },
        careerGrowthFit: { score: 70, confidence: 0.6, reasoning: '' },
        reasoning: 'Reasonable overlap.',
      }),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'mock-model',
      confidence: 0.6,
      requestId: crypto.randomUUID(),
    };
  }
}

class InMemoryMatchResultRepositoryFake implements MatchResultRepository {
  private readonly bySearchProfileAndVacancy = new Map<string, MatchResult>();

  async save(matchResult: MatchResult): Promise<void> {
    this.bySearchProfileAndVacancy.set(this.key(matchResult.searchProfileId, matchResult.vacancyId), matchResult);
  }

  async findById(id: string): Promise<MatchResult | null> {
    return [...this.bySearchProfileAndVacancy.values()].find((m) => m.id === id) ?? null;
  }

  async findBySearchProfileIdAndVacancyId(searchProfileId: string, vacancyId: string): Promise<MatchResult | null> {
    return this.bySearchProfileAndVacancy.get(this.key(searchProfileId, vacancyId)) ?? null;
  }

  async findByUserId(userId: string): Promise<readonly MatchResult[]> {
    return [...this.bySearchProfileAndVacancy.values()].filter((m) => m.userId === userId);
  }

  async findBySearchProfileId(searchProfileId: string): Promise<readonly MatchResult[]> {
    return [...this.bySearchProfileAndVacancy.values()].filter((m) => m.searchProfileId === searchProfileId);
  }

  async findByVacancyIds(vacancyIds: readonly string[]): Promise<readonly MatchResult[]> {
    const set = new Set(vacancyIds);
    return [...this.bySearchProfileAndVacancy.values()].filter((m) => set.has(m.vacancyId));
  }

  private key(searchProfileId: string, vacancyId: string): string {
    return `${searchProfileId}:${vacancyId}`;
  }
}

function makeInput(overrides: Partial<AnalyzeVacancyInput> = {}): AnalyzeVacancyInput {
  return {
    vacancyId: 'v1',
    vacancyUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    vacancyTitle: 'Senior TypeScript Developer',
    vacancyDescription: 'Looking for experienced TS dev',
    companyName: 'TechCorp',
    technologies: ['TypeScript'],
    location: 'Remote',
    userId: 'u1',
    searchProfileId: 'sp1',
    searchProfileUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    desiredPositions: ['Backend Engineer'],
    desiredTechnologies: ['TypeScript'],
    desiredExperienceLevel: 'senior',
    isRemoteOnly: true,
    desiredLocations: ['Remote'],
    ...overrides,
  };
}

describe('AnalyzeVacancyHandler', () => {
  let provider: CountingProvider;
  let matchResultRepository: InMemoryMatchResultRepositoryFake;
  let handler: AnalyzeVacancyHandler;

  beforeEach(() => {
    provider = new CountingProvider({ apiKey: 'test' });
    matchResultRepository = new InMemoryMatchResultRepositoryFake();
    handler = new AnalyzeVacancyHandler({
      matchResultRepository,
      cache: new InMemoryAICache(),
      costTracker: new InMemoryCostTracker(),
      logger: new NoopAILogger(),
      metrics: new InMemoryAIMetricsCollector(),
      tracer: new InMemoryAITracer(),
    });
  });

  it('calls the provider and persists a MatchResult on first analysis', async () => {
    const { result, usage } = await handler.execute(makeInput(), provider);

    expect(provider.callCount).toBe(1);
    expect(result.overallScore).toBe(70);
    expect(usage.totalTokens).toBe(30);
    expect(await matchResultRepository.findBySearchProfileIdAndVacancyId('sp1', 'v1')).not.toBeNull();
  });

  it('reuses the persisted MatchResult instead of calling the provider again for the same (vacancy, profile) pair', async () => {
    await handler.execute(makeInput(), provider);
    const { result, usage } = await handler.execute(makeInput(), provider);

    expect(provider.callCount).toBe(1); // still 1 — no second LLM call
    expect(result.overallScore).toBe(70);
    expect(usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('re-analyzes when the vacancy content has actually changed since the stored MatchResult', async () => {
    await handler.execute(makeInput(), provider);
    // Content change (not just a bumped timestamp) — a genuinely different
    // prompt, so this must miss both the DB-level reuse check AND
    // MatchingEngine's own prompt-hash cache.
    await handler.execute(
      makeInput({ vacancyUpdatedAt: new Date('2026-02-01T00:00:00.000Z'), vacancyDescription: 'Looking for a staff-level TS engineer' }),
      provider
    );

    expect(provider.callCount).toBe(2);
  });
});

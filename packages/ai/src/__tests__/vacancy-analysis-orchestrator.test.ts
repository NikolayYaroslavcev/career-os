import { describe, it, expect, beforeEach } from 'vitest';
import { MatchingEngine } from '../matching/matching-engine.js';
import { analyzeVacancyForSearchProfile } from '../matching/vacancy-analysis-orchestrator.js';
import type {
  VacancyAnalysisTarget,
  VacancyAnalysisProfile,
  VacancyAnalysisResume,
} from '../matching/vacancy-analysis-orchestrator.js';
import { VacancyAnalysisPromptBuilder } from '../prompts/vacancy-analysis.js';
import { InMemoryAICache } from '../cache/ai-cache.js';
import { InMemoryCostTracker } from '../cost/cost-tracker-impl.js';
import { NoopAILogger } from '../observability/ai-logger.js';
import { InMemoryAIMetricsCollector } from '../observability/ai-metrics.js';
import { InMemoryAITracer } from '../observability/ai-tracer.js';
import { BaseAIProvider } from '../providers/base-provider.js';
import type { AIRequest, AIResponse, AICapabilities } from '../domain/ai-types.js';
import type { AIProviderConfig } from '../domain/ai-provider.js';
import type { MatchResult } from '../domain/match-result.js';
import type { MatchResultRepository } from '../domain/match-result-repository.js';

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

const target: VacancyAnalysisTarget = {
  vacancyId: 'v1',
  vacancyUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
  vacancyTitle: 'Senior TypeScript Developer',
  vacancyDescription: 'Looking for experienced TS dev',
  companyName: 'TechCorp',
  technologies: ['TypeScript'],
};

const profile: VacancyAnalysisProfile = {
  searchProfileId: 'sp1',
  searchProfileUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
  userId: 'u1',
  desiredPositions: ['Backend Engineer'],
  desiredTechnologies: ['TypeScript'],
};

const resume: VacancyAnalysisResume = {
  resumeId: 'r1',
  resumeUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
  summary: 'Senior developer',
  skills: ['TypeScript'],
  technologies: ['TypeScript'],
  yearsOfExperience: 8,
};

describe('analyzeVacancyForSearchProfile', () => {
  let provider: CountingProvider;
  let matchResultRepository: InMemoryMatchResultRepositoryFake;
  let matchingEngine: MatchingEngine;

  beforeEach(() => {
    provider = new CountingProvider({ apiKey: 'test' });
    matchResultRepository = new InMemoryMatchResultRepositoryFake();
    matchingEngine = new MatchingEngine(
      {
        provider,
        promptBuilder: new VacancyAnalysisPromptBuilder(),
        cache: new InMemoryAICache(),
        costTracker: new InMemoryCostTracker(),
        logger: new NoopAILogger(),
        metrics: new InMemoryAIMetricsCollector(),
        tracer: new InMemoryAITracer(),
      },
      { enableCache: false }
    );
  });

  it('computes and persists a new analysis on first run', async () => {
    const outcome = await analyzeVacancyForSearchProfile(
      { matchingEngine, matchResultRepository },
      target,
      profile
    );

    expect(outcome.reused).toBe(false);
    expect(outcome.matchResult.overallScore).toBe(70);
    expect(outcome.matchResult.resumeId).toBeUndefined();
    expect(provider.callCount).toBe(1);
  });

  it('reuses the cached analysis when nothing changed', async () => {
    await analyzeVacancyForSearchProfile({ matchingEngine, matchResultRepository }, target, profile);
    const second = await analyzeVacancyForSearchProfile({ matchingEngine, matchResultRepository }, target, profile);

    expect(second.reused).toBe(true);
    expect(provider.callCount).toBe(1);
  });

  it('re-analyzes when the vacancy changes', async () => {
    await analyzeVacancyForSearchProfile({ matchingEngine, matchResultRepository }, target, profile);

    const changedTarget: VacancyAnalysisTarget = {
      ...target,
      vacancyUpdatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const second = await analyzeVacancyForSearchProfile(
      { matchingEngine, matchResultRepository },
      changedTarget,
      profile
    );

    expect(second.reused).toBe(false);
    expect(provider.callCount).toBe(2);
  });

  it('keeps the same MatchResult id across re-analysis so external references stay valid', async () => {
    const first = await analyzeVacancyForSearchProfile({ matchingEngine, matchResultRepository }, target, profile);

    const changedTarget: VacancyAnalysisTarget = {
      ...target,
      vacancyUpdatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const second = await analyzeVacancyForSearchProfile(
      { matchingEngine, matchResultRepository },
      changedTarget,
      profile
    );

    expect(second.matchResult.id).toBe(first.matchResult.id);
  });

  it('re-analyzes when the search profile changes', async () => {
    await analyzeVacancyForSearchProfile({ matchingEngine, matchResultRepository }, target, profile);

    const changedProfile: VacancyAnalysisProfile = {
      ...profile,
      searchProfileUpdatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const second = await analyzeVacancyForSearchProfile(
      { matchingEngine, matchResultRepository },
      target,
      changedProfile
    );

    expect(second.reused).toBe(false);
    expect(provider.callCount).toBe(2);
  });

  it('upgrades a profile-only analysis once a resume becomes available', async () => {
    const first = await analyzeVacancyForSearchProfile(
      { matchingEngine, matchResultRepository },
      target,
      profile
    );
    expect(first.matchResult.resumeId).toBeUndefined();

    const second = await analyzeVacancyForSearchProfile(
      { matchingEngine, matchResultRepository },
      target,
      profile,
      resume
    );

    expect(second.reused).toBe(false);
    expect(second.matchResult.resumeId).toBe('r1');
    expect(provider.callCount).toBe(2);

    // Same (searchProfileId, vacancyId) key — the resume-aware result overwrote the profile-only one.
    const stored = await matchResultRepository.findBySearchProfileIdAndVacancyId('sp1', 'v1');
    expect(stored?.resumeId).toBe('r1');
  });
});

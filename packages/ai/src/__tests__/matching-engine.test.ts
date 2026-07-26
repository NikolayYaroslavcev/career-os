import { describe, it, expect, beforeEach } from 'vitest';
import { MatchingEngine, type MatchingEngineDeps } from '../matching/matching-engine.js';
import { VacancyAnalysisPromptBuilder } from '../prompts/vacancy-analysis.js';
import { InMemoryAICache } from '../cache/ai-cache.js';
import { InMemoryCostTracker } from '../cost/cost-tracker-impl.js';
import { NoopAILogger } from '../observability/ai-logger.js';
import { InMemoryAIMetricsCollector } from '../observability/ai-metrics.js';
import { InMemoryAITracer } from '../observability/ai-tracer.js';
import { BaseAIProvider } from '../providers/base-provider.js';
import type { AIRequest, AIResponse, AICapabilities } from '../domain/ai-types.js';
import type { AIProviderConfig } from '../domain/ai-provider.js';

class MockProvider extends BaseAIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';
  private responseData: Record<string, unknown>;
  lastRequest: AIRequest | undefined;

  constructor(config: AIProviderConfig, responseData: Record<string, unknown>) {
    super(config);
    this.responseData = responseData;
  }

  setResponseData(data: Record<string, unknown>): void {
    this.responseData = data;
  }

  getCapabilities(): AICapabilities {
    return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
  }

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    this.lastRequest = request;
    return {
      content: JSON.stringify(this.responseData),
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      model: 'mock-model',
      confidence: 0.9,
      requestId: crypto.randomUUID(),
    };
  }
}

function createDeps(provider: MockProvider): MatchingEngineDeps {
  return {
    provider,
    promptBuilder: new VacancyAnalysisPromptBuilder(),
    cache: new InMemoryAICache(),
    costTracker: new InMemoryCostTracker(),
    logger: new NoopAILogger(),
    metrics: new InMemoryAIMetricsCollector(),
    tracer: new InMemoryAITracer(),
  };
}

describe('MatchingEngine', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider({ apiKey: 'test' }, {
      overallScore: 85,
      confidence: 0.9,
      recommendation: 'StrongApply',
      summary: 'Strong senior TypeScript role.',
      strengths: ['TypeScript expertise', 'React experience'],
      weaknesses: ['No cloud experience'],
      requiredSkills: ['TypeScript', 'React', 'AWS'],
      missingSkills: ['AWS', 'Docker'],
      seniorityEstimation: 'Senior',
      remotePolicy: 'Fully remote',
      salaryObservations: 'Within market range.',
      salaryFit: { score: 70, confidence: 0.8, reasoning: 'Within market range' },
      locationFit: { score: 95, confidence: 0.95, reasoning: 'Remote position matches preference' },
      experienceFit: { score: 80, confidence: 0.85, reasoning: 'Senior level aligned' },
      careerGrowthFit: { score: 75, confidence: 0.7, reasoning: 'Good growth potential' },
      reasoning: 'Strong technical match with some skill gaps to fill.',
    });
  });

  it('produces valid match result', async () => {
    const deps = createDeps(provider);
    const engine = new MatchingEngine(deps, { enableCache: false });

    const result = await engine.match({
      resumeId: 'r1',
      vacancyId: 'v1',
      userId: 'u1',
      searchProfileId: 'sp1',
      inputHash: 'hash-1',
      vacancyTitle: 'Senior TypeScript Developer',
      vacancyDescription: 'Looking for experienced TS dev',
      companyName: 'TechCorp',
      technologies: ['TypeScript', 'React'],
      resumeSummary: 'Senior developer',
      resumeSkills: ['TypeScript', 'React'],
      resumeTechnologies: ['TypeScript', 'React', 'Node.js'],
      yearsOfExperience: 8,
    });

    expect(result.overallScore).toBe(85);
    expect(result.confidence).toBe(0.9);
    expect(result.recommendation).toBe('StrongApply');
    expect(result.strengths).toContain('TypeScript expertise');
    expect(result.missingSkills).toContain('AWS');
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('includes resume raw text in the prompt sent to the provider', async () => {
    const deps = createDeps(provider);
    const engine = new MatchingEngine(deps, { enableCache: false });

    await engine.match({
      resumeId: 'r1',
      vacancyId: 'v1',
      userId: 'u1',
      searchProfileId: 'sp1',
      inputHash: 'hash-1',
      vacancyTitle: 'Senior TypeScript Developer',
      vacancyDescription: 'Looking for experienced TS dev',
      companyName: 'TechCorp',
      technologies: ['TypeScript', 'React'],
      resumeSummary: 'Senior developer',
      resumeSkills: ['TypeScript', 'React'],
      resumeTechnologies: ['TypeScript', 'React', 'Node.js'],
      yearsOfExperience: 8,
      resumeRawText: 'EXTRACTED_PDF_CONTENT: 8 years building distributed systems.',
    });

    expect(provider.lastRequest?.prompt).toContain('EXTRACTED_PDF_CONTENT: 8 years building distributed systems.');
  });

  it('uses cache when enabled', async () => {
    const deps = createDeps(provider);
    const engine = new MatchingEngine(deps, { enableCache: true, cacheTtlMs: 60000 });

    const params = {
      resumeId: 'r1',
      vacancyId: 'v1',
      userId: 'u1',
      searchProfileId: 'sp1',
      inputHash: 'hash-1',
      vacancyTitle: 'Test',
      vacancyDescription: 'Test desc',
      companyName: 'Test Corp',
      technologies: ['TypeScript'],
      resumeSummary: 'Test resume',
      resumeSkills: ['TypeScript'],
      resumeTechnologies: ['TypeScript'],
      yearsOfExperience: 5,
    };

    const result1 = await engine.match(params);
    const result2 = await engine.match(params);

    expect(result1.overallScore).toBe(result2.overallScore);
    // Provider should only be called once due to caching
    expect(provider.validateConfig()).toBe(true);
  });

  it('records metrics', async () => {
    const deps = createDeps(provider);
    const engine = new MatchingEngine(deps, { enableCache: false });

    await engine.match({
      resumeId: 'r1',
      vacancyId: 'v1',
      userId: 'u1',
      searchProfileId: 'sp1',
      inputHash: 'hash-1',
      vacancyTitle: 'Test',
      vacancyDescription: 'Test desc',
      companyName: 'Test Corp',
      technologies: ['TypeScript'],
      resumeSummary: 'Test resume',
      resumeSkills: ['TypeScript'],
      resumeTechnologies: ['TypeScript'],
      yearsOfExperience: 5,
    });

    const metrics = deps.metrics as InMemoryAIMetricsCollector;
    expect(metrics.getCounter('ai.request.completed')).toBe(1);
  });

  it('records cost', async () => {
    const deps = createDeps(provider);
    const engine = new MatchingEngine(deps, { enableCache: false });

    await engine.match({
      resumeId: 'r1',
      vacancyId: 'v1',
      userId: 'u1',
      searchProfileId: 'sp1',
      inputHash: 'hash-1',
      vacancyTitle: 'Test',
      vacancyDescription: 'Test desc',
      companyName: 'Test Corp',
      technologies: ['TypeScript'],
      resumeSummary: 'Test resume',
      resumeSkills: ['TypeScript'],
      resumeTechnologies: ['TypeScript'],
      yearsOfExperience: 5,
    });

    const costSummary = deps.costTracker.getSummary();
    expect(costSummary.totalRequests).toBe(1);
  });
});

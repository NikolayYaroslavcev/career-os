import { describe, it, expect, beforeEach } from 'vitest';
import { ResumeExtractionEngine, type ResumeExtractionEngineDeps } from '../extraction/resume-extraction-engine.js';
import { StructuredResumeExtractionPromptBuilder } from '../prompts/structured-resume-extraction.js';
import { NoopAILogger } from '../observability/ai-logger.js';
import { InMemoryAIMetricsCollector } from '../observability/ai-metrics.js';
import { BaseAIProvider } from '../providers/base-provider.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import type { AIRequest, AIResponse, AICapabilities } from '../domain/ai-types.js';
import type { AIProviderConfig } from '../domain/ai-provider.js';

class MockProvider extends BaseAIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';
  private responseData: Record<string, unknown>;
  private shouldFail = false;
  private callCount = 0;
  lastRequest: AIRequest | undefined;

  constructor(config: AIProviderConfig, responseData: Record<string, unknown>) {
    super(config);
    this.responseData = responseData;
  }

  setResponseData(data: Record<string, unknown>): void {
    this.responseData = data;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  getCallCount(): number {
    return this.callCount;
  }

  getCapabilities(): AICapabilities {
    return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
  }

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    this.callCount++;
    this.lastRequest = request;

    if (this.shouldFail) {
      throw new AIError({ type: AIErrorType.RATE_LIMITED, message: 'Rate limited', provider: 'mock' });
    }

    return {
      content: JSON.stringify(this.responseData),
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      model: 'mock-model',
      confidence: 0.9,
      requestId: crypto.randomUUID(),
    };
  }
}

function createDeps(provider: MockProvider): ResumeExtractionEngineDeps {
  return {
    provider,
    promptBuilder: new StructuredResumeExtractionPromptBuilder(),
    logger: new NoopAILogger(),
    metrics: new InMemoryAIMetricsCollector(),
  };
}

describe('ResumeExtractionEngine', () => {
  let provider: MockProvider;

  const EXTRACTED_DATA = {
    summary: 'Senior software engineer with 8 years of experience in full-stack development.',
    seniorityLevel: 'senior',
    totalYearsOfExperience: 8,
    skills: ['leadership', 'system design', 'mentoring'],
    technologies: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS'],
    experience: [
      {
        company: 'TechCorp',
        position: 'Senior Software Engineer',
        startDate: '2020-01-01',
        endDate: null,
        description: 'Led development of microservices platform.',
        technologies: ['TypeScript', 'Node.js', 'AWS'],
      },
      {
        company: 'StartupInc',
        position: 'Software Engineer',
        startDate: '2016-06-01',
        endDate: '2019-12-31',
        description: 'Built React frontends and REST APIs.',
        technologies: ['React', 'JavaScript', 'PostgreSQL'],
      },
    ],
    education: [
      {
        institution: 'MIT',
        degree: 'BS',
        field: 'Computer Science',
        startDate: '2012-09-01',
        endDate: '2016-06-01',
      },
    ],
  };

  beforeEach(() => {
    provider = new MockProvider({ apiKey: 'test' }, EXTRACTED_DATA);
  });

  it('extracts structured data from resume text', async () => {
    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps);

    const result = await engine.extract('John Doe\nSenior Software Engineer\n...');

    expect(result.summary).toBe(EXTRACTED_DATA.summary);
    expect(result.seniorityLevel).toBe('senior');
    expect(result.totalYearsOfExperience).toBe(8);
    expect(result.skills).toEqual(EXTRACTED_DATA.skills);
    expect(result.technologies).toEqual(EXTRACTED_DATA.technologies);
    expect(result.experience).toHaveLength(2);
    expect(result.education).toHaveLength(1);
  });

  it('sends rawText in the prompt to the provider', async () => {
    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps);

    const rawText = 'Jane Smith\nLead Engineer\n10 years at Google';
    await engine.extract(rawText);

    expect(provider.lastRequest?.prompt).toContain(rawText);
  });

  it('parses experience dates correctly', async () => {
    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps);

    const result = await engine.extract('test');

    expect(result.experience[0]?.startDate).toBeInstanceOf(Date);
    expect(result.experience[0]?.endDate).toBeUndefined();
    expect(result.experience[1]?.endDate).toBeInstanceOf(Date);
  });

  it('handles malformed JSON response', async () => {
    provider.setResponseData({ not: 'valid' });
    provider.setShouldFail(false);

    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps);

    const result = await engine.extract('test');

    expect(result.seniorityLevel).toBe('mid');
    expect(result.totalYearsOfExperience).toBe(0);
    expect(result.skills).toEqual([]);
    expect(result.technologies).toEqual([]);
    expect(result.experience).toEqual([]);
    expect(result.education).toEqual([]);
  });

  it('handles JSON wrapped in fenced code blocks', async () => {
    provider.setResponseData({});

    const originalDoComplete = provider['doComplete'].bind(provider);
    provider['doComplete'] = async function (request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
      const result = await originalDoComplete(request);
      return {
        ...result,
        content: '```json\n' + JSON.stringify(EXTRACTED_DATA) + '\n```',
      };
    };

    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps);

    const result = await engine.extract('test');

    expect(result.seniorityLevel).toBe('senior');
    expect(result.experience).toHaveLength(2);
  });

  it('retries on transient failures', async () => {
    provider.setShouldFail(true);

    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps, { maxRetries: 2 });

    await expect(engine.extract('test')).rejects.toThrow('Resume extraction failed after 3 attempts');
    expect(provider.getCallCount()).toBe(3);
  });

  it('does not retry when maxRetries is 0', async () => {
    provider.setShouldFail(true);

    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps, { maxRetries: 0 });

    await expect(engine.extract('test')).rejects.toThrow();
    expect(provider.getCallCount()).toBe(1);
  });

  it('does not retry on non-retryable errors', async () => {
    const originalDoComplete = provider['doComplete'].bind(provider);
    let callCount = 0;
    provider['doComplete'] = async function (request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
      callCount++;
      if (callCount === 1) {
        throw new Error('Authentication failed');
      }
      return originalDoComplete(request);
    };

    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps, { maxRetries: 2 });

    await expect(engine.extract('test')).rejects.toThrow();
    expect(callCount).toBe(1);
  });

  it('records metrics on success', async () => {
    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps);

    await engine.extract('test');

    const metrics = deps.metrics as InMemoryAIMetricsCollector;
    expect(metrics.getCounter('ai.request.completed')).toBe(1);
    expect(metrics.getCounter('ai.provider.success')).toBe(1);
  });

  it('records metrics on failure', async () => {
    provider.setShouldFail(true);

    const deps = createDeps(provider);
    const engine = new ResumeExtractionEngine(deps, { maxRetries: 1 });

    await expect(engine.extract('test')).rejects.toThrow();

    const metrics = deps.metrics as InMemoryAIMetricsCollector;
    expect(metrics.getCounter('ai.request.failed')).toBeGreaterThanOrEqual(1);
  });
});

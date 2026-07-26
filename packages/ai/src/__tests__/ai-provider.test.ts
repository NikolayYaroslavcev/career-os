import { describe, it, expect } from 'vitest';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import { Recommendation, RECOMMENDATION_PRIORITY, compareRecommendations } from '../domain/recommendation.js';
import { createMatchResult } from '../domain/match-result.js';
import { BaseAIProvider } from '../providers/base-provider.js';
import type { AIRequest, AIResponse, AICapabilities } from '../domain/ai-types.js';
import type { AIProviderConfig } from '../domain/ai-provider.js';

class MockAIProvider extends BaseAIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';
  private responseContent: string;
  private shouldFail = false;
  private failureMessage = 'Mock provider failure';

  constructor(config: AIProviderConfig, responseContent: string) {
    super(config);
    this.responseContent = responseContent;
  }

  setShouldFail(fail: boolean, message?: string): void {
    this.shouldFail = fail;
    if (message !== undefined) this.failureMessage = message;
  }

  setResponseContent(content: string): void {
    this.responseContent = content;
  }

  getCapabilities(): AICapabilities {
    return {
      supportsStreaming: false,
      supportsVision: false,
      maxTokens: 4096,
      supportedModels: ['mock-model'],
    };
  }

  protected async doComplete(_request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    return {
      content: this.responseContent,
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      model: 'mock-model',
      confidence: 0.85,
      requestId: crypto.randomUUID(),
    };
  }
}

describe('AIError', () => {
  it('creates error with correct properties', () => {
    const error = new AIError({
      type: AIErrorType.PROVIDER_ERROR,
      message: 'Test error',
      provider: 'openai',
    });

    expect(error.type).toBe(AIErrorType.PROVIDER_ERROR);
    expect(error.message).toBe('Test error');
    expect(error.provider).toBe('openai');
    expect(error.retryable).toBe(false);
    expect(error.name).toBe('AIError');
  });

  it('marks rate limit errors as retryable', () => {
    const error = new AIError({
      type: AIErrorType.RATE_LIMITED,
      message: 'Rate limited',
      provider: 'anthropic',
    });

    expect(error.retryable).toBe(true);
  });

  it('marks timeout errors as retryable', () => {
    const error = new AIError({
      type: AIErrorType.TIMEOUT,
      message: 'Timeout',
      provider: 'gemini',
    });

    expect(error.retryable).toBe(true);
  });
});

describe('Recommendation', () => {
  it('has correct priority ordering', () => {
    expect(RECOMMENDATION_PRIORITY[Recommendation.STRONG_APPLY]).toBe(4);
    expect(RECOMMENDATION_PRIORITY[Recommendation.APPLY]).toBe(3);
    expect(RECOMMENDATION_PRIORITY[Recommendation.MAYBE]).toBe(2);
    expect(RECOMMENDATION_PRIORITY[Recommendation.SKIP]).toBe(1);
  });

  it('compareRecommendations returns correct order', () => {
    expect(compareRecommendations(Recommendation.SKIP, Recommendation.STRONG_APPLY)).toBeGreaterThan(0);
    expect(compareRecommendations(Recommendation.STRONG_APPLY, Recommendation.SKIP)).toBeLessThan(0);
  });
});

describe('MatchResult', () => {
  it('creates match result with all fields', () => {
    const result = createMatchResult({
      searchProfileId: 'sp1',
      vacancyId: 'v1',
      resumeId: 'r1',
      userId: 'u1',
      overallScore: 85,
      confidence: 0.9,
      recommendation: 'StrongApply',
      summary: 'Strong senior TypeScript role, fully remote.',
      strengths: ['TypeScript expertise'],
      weaknesses: ['No cloud experience'],
      requiredSkills: ['TypeScript', 'AWS'],
      missingSkills: ['AWS'],
      seniorityEstimation: 'Senior',
      remotePolicy: 'Fully remote',
      salaryObservations: 'Within market range for the role.',
      salaryFit: { score: 70, confidence: 0.8, reasoning: 'Within range' },
      locationFit: { score: 90, confidence: 0.95, reasoning: 'Remote' },
      experienceFit: { score: 80, confidence: 0.85, reasoning: 'Senior level' },
      careerGrowthFit: { score: 75, confidence: 0.7, reasoning: 'Growth opportunity' },
      reasoning: 'Strong technical match',
      model: 'gpt-4o',
      provider: 'openai',
      promptVersion: '1.0.0',
      promptId: 'vacancy-analysis',
      matchingAlgorithmVersion: '1.0.0',
      inputHash: 'hash-1',
      tokenUsage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      latencyMs: 150,
      estimatedCostUsd: 0.0075,
    });

    expect(result.overallScore).toBe(85);
    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(result.strengths).toEqual(['TypeScript expertise']);
  });
});

describe('BaseAIProvider', () => {
  it('validates config correctly', () => {
    const provider = new MockAIProvider({ apiKey: 'test-key' }, '{}');
    expect(provider.validateConfig()).toBe(true);
  });

  it('rejects empty API key', () => {
    const provider = new MockAIProvider({ apiKey: '' }, '{}');
    expect(provider.validateConfig()).toBe(false);
  });

  it('returns capabilities', () => {
    const provider = new MockAIProvider({ apiKey: 'test' }, '{}');
    const caps = provider.getCapabilities();
    expect(caps.supportedModels).toContain('mock-model');
  });

  it('completes request successfully', async () => {
    const provider = new MockAIProvider({ apiKey: 'test' }, '{"score": 80}');
    const response = await provider.complete({
      prompt: 'test',
      promptId: 'test',
      promptVersion: '1.0',
      promptChecksum: 'abc',
    });

    expect(response.content).toBe('{"score": 80}');
    expect(response.provider).toBe('mock');
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('throws AIError on provider failure', async () => {
    const provider = new MockAIProvider({ apiKey: 'test' }, '{}');
    provider.setShouldFail(true);

    await expect(provider.complete({
      prompt: 'test',
      promptId: 'test',
      promptVersion: '1.0',
      promptChecksum: 'abc',
    })).rejects.toThrow(AIError);
  });

  it('classifies a "request too large" / rate_limit_exceeded failure as RATE_LIMITED and retryable, not QUOTA_EXCEEDED', async () => {
    const provider = new MockAIProvider({ apiKey: 'test' }, '{}');
    provider.setShouldFail(
      true,
      'Groq API error 413: {"error":{"message":"Request too large for model `llama-3.1-8b-instant` on tokens ' +
        'per minute (TPM): Limit 6000, Requested 6231.","type":"tokens","code":"rate_limit_exceeded"}}'
    );

    try {
      await provider.complete({ prompt: 'test', promptId: 'test', promptVersion: '1.0', promptChecksum: 'abc' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIError);
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.RATE_LIMITED);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('still classifies genuine quota/billing failures as QUOTA_EXCEEDED', async () => {
    const provider = new MockAIProvider({ apiKey: 'test' }, '{}');
    provider.setShouldFail(true, 'insufficient_quota: you have exceeded your current billing quota');

    try {
      await provider.complete({ prompt: 'test', promptId: 'test', promptVersion: '1.0', promptChecksum: 'abc' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIError);
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.QUOTA_EXCEEDED);
      expect(aiError.retryable).toBe(false);
    }
  });
});

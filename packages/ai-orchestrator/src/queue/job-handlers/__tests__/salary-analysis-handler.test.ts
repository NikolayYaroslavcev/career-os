import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAIProvider } from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig } from '@careeros/ai';
import { SalaryAnalysisHandler, type SalaryAnalysisInput } from '../salary-analysis-handler.js';

class MockProvider extends BaseAIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';
  private responseContent: string;

  constructor(config: AIProviderConfig, responseContent: string) {
    super(config);
    this.responseContent = responseContent;
  }

  getCapabilities(): AICapabilities {
    return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
  }

  protected async doComplete(_request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    return {
      content: this.responseContent,
      usage: { promptTokens: 40, completionTokens: 80, totalTokens: 120 },
      model: 'mock-model',
      confidence: 0.8,
      requestId: crypto.randomUUID(),
    };
  }
}

function makeInput(overrides: Partial<SalaryAnalysisInput> = {}): SalaryAnalysisInput {
  return {
    jobTitle: 'Senior TypeScript Developer',
    location: 'Berlin, Germany',
    technologies: ['TypeScript', 'React'],
    experienceLevel: 'senior',
    ...overrides,
  };
}

const VALID_RESPONSE = JSON.stringify({
  estimatedRange: { min: 80000, max: 120000, median: 100000, currency: 'EUR' },
  marketPosition: 'Above average for Berlin',
  factors: ['TypeScript demand', 'Remote work premium', 'Startup ecosystem'],
  recommendations: ['Negotiate for equity', 'Consider remote-first companies'],
});

describe('SalaryAnalysisHandler', () => {
  let handler: SalaryAnalysisHandler;

  beforeEach(() => {
    handler = new SalaryAnalysisHandler();
  });

  describe('feature identifier', () => {
    it('declares salary_analysis as its feature', () => {
      expect(handler.feature).toBe('salary_analysis');
    });
  });

  describe('successful execution', () => {
    it('returns parsed salary analysis with all fields', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result, usage } = await handler.execute(makeInput(), provider);

      expect(result.estimatedRange.min).toBe(80000);
      expect(result.estimatedRange.max).toBe(120000);
      expect(result.estimatedRange.median).toBe(100000);
      expect(result.estimatedRange.currency).toBe('EUR');
      expect(result.marketPosition).toBe('Above average for Berlin');
      expect(result.factors).toHaveLength(3);
      expect(result.recommendations).toHaveLength(2);
      expect(usage.totalTokens).toBe(120);
    });

    it('handles optional fields', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const input = makeInput({ company: 'TechCorp', providedSalaryMin: 90000, providedSalaryMax: 110000, candidateExperienceYears: 7, candidateSkills: ['TypeScript'] });
      const { result } = await handler.execute(input, provider);
      expect(result.estimatedRange).toBeDefined();
    });
  });

  describe('input handling', () => {
    it('works with empty technologies array', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result } = await handler.execute(makeInput({ technologies: [] }), provider);
      expect(result.estimatedRange).toBeDefined();
    });

    it('works without optional company and salary fields', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const input = makeInput({ company: undefined, providedSalaryMin: undefined, providedSalaryMax: undefined, candidateExperienceYears: undefined, candidateSkills: undefined });
      const { result } = await handler.execute(input, provider);
      expect(result.estimatedRange).toBeDefined();
    });
  });

  describe('output parsing', () => {
    it('defaults currency to USD when missing', async () => {
      const response = JSON.stringify({
        estimatedRange: { min: 80000, max: 120000, median: 100000 },
        marketPosition: 'average',
        factors: [],
        recommendations: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.estimatedRange.currency).toBe('USD');
    });

    it('defaults numeric values to 0 when missing', async () => {
      const response = JSON.stringify({
        estimatedRange: {},
        marketPosition: '',
        factors: [],
        recommendations: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.estimatedRange.min).toBe(0);
      expect(result.estimatedRange.max).toBe(0);
      expect(result.estimatedRange.median).toBe(0);
    });

    it('converts non-numeric values to 0', async () => {
      const response = JSON.stringify({
        estimatedRange: { min: 'not-a-number', max: 'also-not', median: 'nope', currency: 'EUR' },
        marketPosition: 'average',
        factors: [],
        recommendations: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.estimatedRange.min).toBe(0);
      expect(result.estimatedRange.max).toBe(0);
      expect(result.estimatedRange.median).toBe(0);
    });

    it('defaults factors to empty array when missing', async () => {
      const response = JSON.stringify({
        estimatedRange: { min: 80000, max: 120000, median: 100000, currency: 'EUR' },
        marketPosition: 'average',
        recommendations: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.factors).toEqual([]);
    });

    it('defaults recommendations to empty array when missing', async () => {
      const response = JSON.stringify({
        estimatedRange: { min: 80000, max: 120000, median: 100000, currency: 'EUR' },
        marketPosition: 'average',
        factors: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.recommendations).toEqual([]);
    });

    it('extracts JSON from markdown-wrapped response', async () => {
      const response = '```json\n' + VALID_RESPONSE + '\n```';
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.estimatedRange.min).toBe(80000);
    });

    it('throws when response contains no JSON', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, 'Plain text');
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow('Failed to parse AI response as JSON');
    });

    it('throws when response is empty', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, '');
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow();
    });
  });

  describe('prompt construction', () => {
    it('uses SalaryAnalysisPromptBuilder for structured prompts', async () => {
      let capturedSystemPrompt = '';
      let capturedUserPrompt = '';
      class CapturingProvider extends BaseAIProvider {
        readonly name = 'mock';
        readonly defaultModel = 'mock-model';
        getCapabilities(): AICapabilities {
          return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
        }
        protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
          capturedSystemPrompt = request.systemPrompt;
          capturedUserPrompt = request.prompt;
          return { content: VALID_RESPONSE, usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: 'mock-model', confidence: 0.8, requestId: crypto.randomUUID() };
        }
      }

      const provider = new CapturingProvider({ apiKey: 'test' });
      await handler.execute(makeInput(), provider);

      expect(capturedSystemPrompt).toBeTruthy();
      expect(capturedUserPrompt).toContain('Senior TypeScript Developer');
      expect(capturedUserPrompt).toContain('Berlin, Germany');
    });
  });

  describe('provider error handling', () => {
    it('propagates provider errors', async () => {
      class ErrorProvider extends BaseAIProvider {
        readonly name = 'mock';
        readonly defaultModel = 'mock-model';
        getCapabilities(): AICapabilities {
          return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
        }
        protected async doComplete(): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
          throw new Error('Timeout');
        }
      }

      const provider = new ErrorProvider({ apiKey: 'test' });
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow('Timeout');
    });
  });
});

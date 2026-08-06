import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAIProvider } from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig } from '@careeros/ai';
import { CompanyAnalysisHandler, type CompanyAnalysisInput } from '../company-analysis-handler.js';

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
      usage: { promptTokens: 30, completionTokens: 90, totalTokens: 120 },
      model: 'mock-model',
      confidence: 0.8,
      requestId: crypto.randomUUID(),
    };
  }
}

function makeInput(overrides: Partial<CompanyAnalysisInput> = {}): CompanyAnalysisInput {
  return {
    companyName: 'TechCorp',
    industry: 'Technology',
    size: 'large',
    website: 'https://techcorp.com',
    technologies: ['TypeScript', 'React', 'Node.js'],
    ...overrides,
  };
}

const VALID_RESPONSE = JSON.stringify({
  overview: 'TechCorp is a leading technology company...',
  culture: 'Fast-paced, innovation-driven culture',
  pros: ['Great benefits', 'Remote-friendly', 'Strong engineering culture'],
  cons: ['Long hours', 'High pressure'],
  techStack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
  growthPotential: 'High growth potential in the AI market',
  recommendation: 'Recommended for senior engineers seeking growth',
});

describe('CompanyAnalysisHandler', () => {
  let handler: CompanyAnalysisHandler;

  beforeEach(() => {
    handler = new CompanyAnalysisHandler();
  });

  describe('feature identifier', () => {
    it('declares company_analysis as its feature', () => {
      expect(handler.feature).toBe('company_analysis');
    });
  });

  describe('successful execution', () => {
    it('returns parsed company analysis with all fields', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result, usage } = await handler.execute(makeInput(), provider);

      expect(result.overview).toBe('TechCorp is a leading technology company...');
      expect(result.culture).toBe('Fast-paced, innovation-driven culture');
      expect(result.pros).toEqual(['Great benefits', 'Remote-friendly', 'Strong engineering culture']);
      expect(result.cons).toEqual(['Long hours', 'High pressure']);
      expect(result.techStack).toEqual(['TypeScript', 'React', 'Node.js', 'PostgreSQL']);
      expect(result.growthPotential).toBe('High growth potential in the AI market');
      expect(result.recommendation).toBe('Recommended for senior engineers seeking growth');
      expect(usage.totalTokens).toBe(120);
    });
  });

  describe('input handling', () => {
    it('works with only required field (companyName)', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const input = makeInput({ industry: undefined, size: undefined, website: undefined, technologies: undefined });
      const { result } = await handler.execute(input, provider);
      expect(result.overview).toBeDefined();
    });

    it('works with empty technologies array', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result } = await handler.execute(makeInput({ technologies: [] }), provider);
      expect(result.overview).toBeDefined();
    });

    it('works without website', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result } = await handler.execute(makeInput({ website: undefined }), provider);
      expect(result.overview).toBeDefined();
    });
  });

  describe('output parsing', () => {
    it('defaults overview to empty string when missing', async () => {
      const response = JSON.stringify({ culture: 'c', pros: [], cons: [], techStack: [], growthPotential: 'g', recommendation: 'r' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.overview).toBe('');
    });

    it('defaults culture to empty string when missing', async () => {
      const response = JSON.stringify({ overview: 'o', pros: [], cons: [], techStack: [], growthPotential: 'g', recommendation: 'r' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.culture).toBe('');
    });

    it('defaults pros to empty array when missing', async () => {
      const response = JSON.stringify({ overview: 'o', culture: 'c', cons: [], techStack: [], growthPotential: 'g', recommendation: 'r' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.pros).toEqual([]);
    });

    it('defaults cons to empty array when missing', async () => {
      const response = JSON.stringify({ overview: 'o', culture: 'c', pros: [], techStack: [], growthPotential: 'g', recommendation: 'r' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.cons).toEqual([]);
    });

    it('defaults techStack to empty array when missing', async () => {
      const response = JSON.stringify({ overview: 'o', culture: 'c', pros: [], cons: [], growthPotential: 'g', recommendation: 'r' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.techStack).toEqual([]);
    });

    it('converts non-array fields to empty arrays', async () => {
      const response = JSON.stringify({ overview: 'o', culture: 'c', pros: 'not-array', cons: 'not-array', techStack: 'not-array', growthPotential: 'g', recommendation: 'r' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.pros).toEqual([]);
      expect(result.cons).toEqual([]);
      expect(result.techStack).toEqual([]);
    });

    it('extracts JSON from markdown-wrapped response', async () => {
      const response = '```json\n' + VALID_RESPONSE + '\n```';
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.overview).toBe('TechCorp is a leading technology company...');
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
    it('includes company name in prompt', async () => {
      let capturedPrompt = '';
      class CapturingProvider extends BaseAIProvider {
        readonly name = 'mock';
        readonly defaultModel = 'mock-model';
        getCapabilities(): AICapabilities {
          return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
        }
        protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
          capturedPrompt = request.prompt;
          return { content: VALID_RESPONSE, usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: 'mock-model', confidence: 0.8, requestId: crypto.randomUUID() };
        }
      }

      const provider = new CapturingProvider({ apiKey: 'test' });
      await handler.execute(makeInput(), provider);

      expect(capturedPrompt).toContain('TechCorp');
    });

    it('includes industry and size when provided', async () => {
      let capturedPrompt = '';
      class CapturingProvider extends BaseAIProvider {
        readonly name = 'mock';
        readonly defaultModel = 'mock-model';
        getCapabilities(): AICapabilities {
          return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
        }
        protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
          capturedPrompt = request.prompt;
          return { content: VALID_RESPONSE, usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: 'mock-model', confidence: 0.8, requestId: crypto.randomUUID() };
        }
      }

      const provider = new CapturingProvider({ apiKey: 'test' });
      await handler.execute(makeInput(), provider);

      expect(capturedPrompt).toContain('Technology');
      expect(capturedPrompt).toContain('large');
    });

    it('uses untrusted content wrappers for company name', async () => {
      let capturedPrompt = '';
      class CapturingProvider extends BaseAIProvider {
        readonly name = 'mock';
        readonly defaultModel = 'mock-model';
        getCapabilities(): AICapabilities {
          return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
        }
        protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
          capturedPrompt = request.prompt;
          return { content: VALID_RESPONSE, usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: 'mock-model', confidence: 0.8, requestId: crypto.randomUUID() };
        }
      }

      const provider = new CapturingProvider({ apiKey: 'test' });
      await handler.execute(makeInput(), provider);

      expect(capturedPrompt).toContain('<<<EXTERNAL_DATA_');
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
          throw new Error('Service unavailable');
        }
      }

      const provider = new ErrorProvider({ apiKey: 'test' });
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow('Service unavailable');
    });
  });
});

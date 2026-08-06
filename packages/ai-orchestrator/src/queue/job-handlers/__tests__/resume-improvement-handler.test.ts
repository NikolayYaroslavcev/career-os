import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAIProvider } from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig } from '@careeros/ai';
import { ResumeImprovementHandler, type ResumeImprovementInput } from '../resume-improvement-handler.js';

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
      usage: { promptTokens: 60, completionTokens: 150, totalTokens: 210 },
      model: 'mock-model',
      confidence: 0.8,
      requestId: crypto.randomUUID(),
    };
  }
}

function makeInput(overrides: Partial<ResumeImprovementInput> = {}): ResumeImprovementInput {
  return {
    resumeText: 'John Doe\nSenior Developer\n5 years TypeScript experience\nBuilt web applications',
    targetRole: 'Staff Engineer',
    targetTechnologies: ['TypeScript', 'React', 'Node.js'],
    ...overrides,
  };
}

const VALID_RESPONSE = JSON.stringify({
  overallScore: 72,
  strengths: ['Clear career progression', 'Strong technical skills'],
  weaknesses: ['Missing leadership examples', 'No metrics on impact'],
  improvements: [
    { section: 'Experience', issue: 'No quantified achievements', suggestion: 'Add metrics like "reduced load time by 40%"', priority: 'high' },
    { section: 'Skills', issue: 'Outdated technologies listed', suggestion: 'Remove jQuery, add TypeScript', priority: 'medium' },
  ],
  improvedSummary: 'Senior developer with 5 years of TypeScript experience and a track record of building scalable web applications',
  topSkills: ['TypeScript', 'React', 'System Design'],
});

describe('ResumeImprovementHandler', () => {
  let handler: ResumeImprovementHandler;

  beforeEach(() => {
    handler = new ResumeImprovementHandler();
  });

  describe('feature identifier', () => {
    it('declares resume_improvement as its feature', () => {
      expect(handler.feature).toBe('resume_improvement');
    });
  });

  describe('successful execution', () => {
    it('returns parsed resume improvement with all fields', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result, usage } = await handler.execute(makeInput(), provider);

      expect(result.overallScore).toBe(72);
      expect(result.strengths).toEqual(['Clear career progression', 'Strong technical skills']);
      expect(result.weaknesses).toEqual(['Missing leadership examples', 'No metrics on impact']);
      expect(result.improvements).toHaveLength(2);
      expect(result.improvements[0]?.section).toBe('Experience');
      expect(result.improvements[0]?.priority).toBe('high');
      expect(result.improvedSummary).toContain('Senior developer');
      expect(result.topSkills).toEqual(['TypeScript', 'React', 'System Design']);
      expect(usage.totalTokens).toBe(210);
    });

    it('accepts all valid priority levels', async () => {
      const response = JSON.stringify({
        overallScore: 50,
        strengths: [],
        weaknesses: [],
        improvements: [
          { section: 'A', issue: 'i', suggestion: 's', priority: 'high' },
          { section: 'B', issue: 'i', suggestion: 's', priority: 'medium' },
          { section: 'C', issue: 'i', suggestion: 's', priority: 'low' },
        ],
        improvedSummary: '',
        topSkills: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.improvements[0]?.priority).toBe('high');
      expect(result.improvements[1]?.priority).toBe('medium');
      expect(result.improvements[2]?.priority).toBe('low');
    });
  });

  describe('input handling', () => {
    it('works without targetRole', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result } = await handler.execute(makeInput({ targetRole: undefined }), provider);
      expect(result.overallScore).toBeDefined();
    });

    it('works without targetTechnologies', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result } = await handler.execute(makeInput({ targetTechnologies: undefined }), provider);
      expect(result.overallScore).toBeDefined();
    });

    it('works with empty targetTechnologies', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result } = await handler.execute(makeInput({ targetTechnologies: [] }), provider);
      expect(result.overallScore).toBeDefined();
    });
  });

  describe('output parsing', () => {
    it('clamps overallScore to 0-100 range', async () => {
      const response = JSON.stringify({
        overallScore: 150,
        strengths: [],
        weaknesses: [],
        improvements: [],
        improvedSummary: '',
        topSkills: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.overallScore).toBe(100);
    });

    it('clamps negative overallScore to 0', async () => {
      const response = JSON.stringify({
        overallScore: -10,
        strengths: [],
        weaknesses: [],
        improvements: [],
        improvedSummary: '',
        topSkills: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.overallScore).toBe(0);
    });

    it('defaults overallScore to 0 when missing', async () => {
      const response = JSON.stringify({
        strengths: [],
        weaknesses: [],
        improvements: [],
        improvedSummary: '',
        topSkills: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.overallScore).toBe(0);
    });

    it('defaults strengths to empty array when missing', async () => {
      const response = JSON.stringify({
        overallScore: 50,
        weaknesses: [],
        improvements: [],
        improvedSummary: '',
        topSkills: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.strengths).toEqual([]);
    });

    it('defaults weaknesses to empty array when missing', async () => {
      const response = JSON.stringify({
        overallScore: 50,
        strengths: [],
        improvements: [],
        improvedSummary: '',
        topSkills: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.weaknesses).toEqual([]);
    });

    it('defaults improvements to empty array when missing', async () => {
      const response = JSON.stringify({
        overallScore: 50,
        strengths: [],
        weaknesses: [],
        improvedSummary: '',
        topSkills: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.improvements).toEqual([]);
    });

    it('defaults priority to medium when invalid', async () => {
      const response = JSON.stringify({
        overallScore: 50,
        strengths: [],
        weaknesses: [],
        improvements: [{ section: 'A', issue: 'i', suggestion: 's', priority: 'invalid' }],
        improvedSummary: '',
        topSkills: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.improvements[0]?.priority).toBe('medium');
    });

    it('converts non-array fields to empty arrays', async () => {
      const response = JSON.stringify({
        overallScore: 50,
        strengths: 'not-array',
        weaknesses: 'not-array',
        improvements: 'not-array',
        improvedSummary: '',
        topSkills: 'not-array',
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.strengths).toEqual([]);
      expect(result.weaknesses).toEqual([]);
      expect(result.improvements).toEqual([]);
      expect(result.topSkills).toEqual([]);
    });

    it('extracts JSON from markdown-wrapped response', async () => {
      const response = '```json\n' + VALID_RESPONSE + '\n```';
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.overallScore).toBe(72);
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
    it('includes resume text in prompt', async () => {
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

      expect(capturedPrompt).toContain('John Doe');
      expect(capturedPrompt).toContain('Senior Developer');
    });

    it('includes target role when provided', async () => {
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

      expect(capturedPrompt).toContain('Staff Engineer');
    });

    it('uses untrusted content wrappers', async () => {
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
          throw new Error('Model overloaded');
        }
      }

      const provider = new ErrorProvider({ apiKey: 'test' });
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow('Model overloaded');
    });
  });
});

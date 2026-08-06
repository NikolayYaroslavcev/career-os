import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAIProvider } from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig } from '@careeros/ai';
import { InterviewPrepHandler, type InterviewPrepInput } from '../interview-prep-handler.js';

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
      usage: { promptTokens: 80, completionTokens: 200, totalTokens: 280 },
      model: 'mock-model',
      confidence: 0.8,
      requestId: crypto.randomUUID(),
    };
  }
}

function makeInput(overrides: Partial<InterviewPrepInput> = {}): InterviewPrepInput {
  return {
    vacancyTitle: 'Senior TypeScript Developer',
    vacancyDescription: 'Looking for experienced TS dev',
    companyName: 'TechCorp',
    technologies: ['TypeScript', 'React'],
    interviewType: 'TECHNICAL',
    resumeText: 'Experienced developer with 5 years TypeScript',
    ...overrides,
  };
}

const VALID_RESPONSE = JSON.stringify({
  questions: [
    { question: 'Explain TypeScript generics', expectedAnswer: 'Generics allow...', difficulty: 'medium', category: 'TypeScript' },
    { question: 'What is React.memo?', expectedAnswer: 'React.memo is...', difficulty: 'easy', category: 'React' },
  ],
  tips: ['Review TypeScript utility types', 'Practice coding challenges'],
  keyTopics: ['TypeScript generics', 'React hooks', 'System design'],
});

describe('InterviewPrepHandler', () => {
  let handler: InterviewPrepHandler;

  beforeEach(() => {
    handler = new InterviewPrepHandler();
  });

  describe('feature identifier', () => {
    it('declares interview_prep as its feature', () => {
      expect(handler.feature).toBe('interview_prep');
    });
  });

  describe('successful execution', () => {
    it('returns parsed interview questions with all fields', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result, usage } = await handler.execute(makeInput(), provider);

      expect(result.questions).toHaveLength(2);
      expect(result.questions[0]?.question).toBe('Explain TypeScript generics');
      expect(result.questions[0]?.difficulty).toBe('medium');
      expect(result.questions[0]?.category).toBe('TypeScript');
      expect(result.tips).toHaveLength(2);
      expect(result.keyTopics).toHaveLength(3);
      expect(usage.totalTokens).toBe(280);
    });

    it('accepts all valid difficulty levels', async () => {
      const response = JSON.stringify({
        questions: [
          { question: 'Q1', expectedAnswer: 'A1', difficulty: 'easy', category: 'general' },
          { question: 'Q2', expectedAnswer: 'A2', difficulty: 'medium', category: 'general' },
          { question: 'Q3', expectedAnswer: 'A3', difficulty: 'hard', category: 'general' },
        ],
        tips: [],
        keyTopics: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.questions[0]?.difficulty).toBe('easy');
      expect(result.questions[1]?.difficulty).toBe('medium');
      expect(result.questions[2]?.difficulty).toBe('hard');
    });
  });

  describe('input handling', () => {
    it('handles all interview types', async () => {
      const types = ['HR', 'TECHNICAL', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'CODING', 'CULTURAL', 'FINAL'] as const;
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);

      for (const type of types) {
        const { result } = await handler.execute(makeInput({ interviewType: type }), provider);
        expect(result.questions).toBeDefined();
      }
    });

    it('works with empty technologies array', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result } = await handler.execute(makeInput({ technologies: [] }), provider);
      expect(result.questions).toBeDefined();
    });

    it('works with empty resume text', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result } = await handler.execute(makeInput({ resumeText: '' }), provider);
      expect(result.questions).toBeDefined();
    });
  });

  describe('output parsing', () => {
    it('defaults difficulty to medium when provider returns invalid difficulty', async () => {
      const response = JSON.stringify({
        questions: [{ question: 'Q', expectedAnswer: 'A', difficulty: 'invalid', category: 'general' }],
        tips: [],
        keyTopics: [],
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.questions[0]?.difficulty).toBe('medium');
    });

    it('defaults questions to empty array when missing', async () => {
      const response = JSON.stringify({ tips: ['tip'], keyTopics: ['topic'] });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.questions).toEqual([]);
    });

    it('defaults tips to empty array when missing', async () => {
      const response = JSON.stringify({ questions: [], keyTopics: ['topic'] });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.tips).toEqual([]);
    });

    it('defaults keyTopics to empty array when missing', async () => {
      const response = JSON.stringify({ questions: [], tips: ['tip'] });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.keyTopics).toEqual([]);
    });

    it('converts non-array questions to empty array', async () => {
      const response = JSON.stringify({ questions: 'not-array', tips: [], keyTopics: [] });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.questions).toEqual([]);
    });

    it('extracts JSON from markdown-wrapped response', async () => {
      const response = '```json\n' + VALID_RESPONSE + '\n```';
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.questions).toHaveLength(2);
    });

    it('throws when response contains no JSON', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, 'Plain text response');
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow('Failed to parse AI response as JSON');
    });

    it('throws when response is empty', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, '');
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow();
    });
  });

  describe('prompt construction', () => {
    it('includes interview type, company, and position in prompt', async () => {
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

      expect(capturedPrompt).toContain('TECHNICAL');
      expect(capturedPrompt).toContain('TechCorp');
      expect(capturedPrompt).toContain('Senior TypeScript Developer');
    });

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

      expect(capturedPrompt).toContain('Experienced developer with 5 years TypeScript');
    });

    it('uses untrusted content wrappers for external data', async () => {
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
          throw new Error('Rate limit exceeded');
        }
      }

      const provider = new ErrorProvider({ apiKey: 'test' });
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow('Rate limit exceeded');
    });
  });
});

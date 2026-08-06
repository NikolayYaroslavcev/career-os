import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAIProvider } from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig } from '@careeros/ai';
import { CareerAdviceHandler, type CareerAdviceInput } from '../career-advice-handler.js';

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
      usage: { promptTokens: 40, completionTokens: 120, totalTokens: 160 },
      model: 'mock-model',
      confidence: 0.8,
      requestId: crypto.randomUUID(),
    };
  }
}

function makeInput(overrides: Partial<CareerAdviceInput> = {}): CareerAdviceInput {
  return {
    question: 'Should I switch from backend to full-stack development?',
    currentRole: 'Senior Backend Engineer',
    experience: '5 years',
    skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
    goals: 'Become a tech lead within 2 years',
    ...overrides,
  };
}

const VALID_RESPONSE = JSON.stringify({
  advice: 'Transitioning to full-stack is a strategic move given your backend foundation...',
  actionableSteps: ['Learn React fundamentals', 'Build 2-3 full-stack projects', 'Contribute to open source frontend'],
  resources: [
    { title: 'React Official Tutorial', type: 'course', url: 'https://react.dev' },
    { title: 'Full Stack Open', type: 'course', url: 'https://fullstackopen.com' },
    { title: 'Clean Architecture', type: 'book' },
  ],
  timeframe: '6-12 months with consistent effort',
});

describe('CareerAdviceHandler', () => {
  let handler: CareerAdviceHandler;

  beforeEach(() => {
    handler = new CareerAdviceHandler();
  });

  describe('feature identifier', () => {
    it('declares career_advice as its feature', () => {
      expect(handler.feature).toBe('career_advice');
    });
  });

  describe('successful execution', () => {
    it('returns parsed career advice with all fields', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result, usage } = await handler.execute(makeInput(), provider);

      expect(result.advice).toContain('full-stack');
      expect(result.actionableSteps).toHaveLength(3);
      expect(result.resources).toHaveLength(3);
      expect(result.resources[0]?.title).toBe('React Official Tutorial');
      expect(result.resources[0]?.type).toBe('course');
      expect(result.resources[0]?.url).toBe('https://react.dev');
      expect(result.resources[2]?.url).toBeUndefined();
      expect(result.timeframe).toBe('6-12 months with consistent effort');
      expect(usage.totalTokens).toBe(160);
    });

    it('accepts all valid resource types', async () => {
      const response = JSON.stringify({
        advice: 'advice',
        actionableSteps: [],
        resources: [
          { title: 'A', type: 'course' },
          { title: 'B', type: 'book' },
          { title: 'C', type: 'article' },
          { title: 'D', type: 'tool' },
        ],
        timeframe: '1 month',
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.resources[0]?.type).toBe('course');
      expect(result.resources[1]?.type).toBe('book');
      expect(result.resources[2]?.type).toBe('article');
      expect(result.resources[3]?.type).toBe('tool');
    });
  });

  describe('input handling', () => {
    it('works with only required field (question)', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const input = makeInput({ currentRole: undefined, experience: undefined, skills: undefined, goals: undefined });
      const { result } = await handler.execute(input, provider);
      expect(result.advice).toBeDefined();
    });

    it('works with empty skills array', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result } = await handler.execute(makeInput({ skills: [] }), provider);
      expect(result.advice).toBeDefined();
    });

    it('works with empty question (schema allows it)', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      // Note: the handler itself doesn't validate - the route schema does
      const { result } = await handler.execute(makeInput({ question: '' }), provider);
      expect(result.advice).toBeDefined();
    });
  });

  describe('output parsing', () => {
    it('defaults advice to empty string when missing', async () => {
      const response = JSON.stringify({ actionableSteps: [], resources: [], timeframe: '' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.advice).toBe('');
    });

    it('defaults actionableSteps to empty array when missing', async () => {
      const response = JSON.stringify({ advice: 'a', resources: [], timeframe: '' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.actionableSteps).toEqual([]);
    });

    it('defaults resources to empty array when missing', async () => {
      const response = JSON.stringify({ advice: 'a', actionableSteps: [], timeframe: '' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.resources).toEqual([]);
    });

    it('defaults timeframe to empty string when missing', async () => {
      const response = JSON.stringify({ advice: 'a', actionableSteps: [], resources: [] });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.timeframe).toBe('');
    });

    it('defaults resource type to article when invalid', async () => {
      const response = JSON.stringify({
        advice: 'a',
        actionableSteps: [],
        resources: [{ title: 'T', type: 'invalid' }],
        timeframe: '',
      });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.resources[0]?.type).toBe('article');
    });

    it('converts non-array actionableSteps to empty array', async () => {
      const response = JSON.stringify({ advice: 'a', actionableSteps: 'not-array', resources: [], timeframe: '' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.actionableSteps).toEqual([]);
    });

    it('converts non-array resources to empty array', async () => {
      const response = JSON.stringify({ advice: 'a', actionableSteps: [], resources: 'not-array', timeframe: '' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.resources).toEqual([]);
    });

    it('extracts JSON from markdown-wrapped response', async () => {
      const response = '```json\n' + VALID_RESPONSE + '\n```';
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.advice).toContain('full-stack');
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
    it('includes question in prompt', async () => {
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

      expect(capturedPrompt).toContain('Should I switch from backend to full-stack development?');
    });

    it('includes current role when provided', async () => {
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

      expect(capturedPrompt).toContain('Senior Backend Engineer');
    });

    it('includes skills when provided', async () => {
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

      expect(capturedPrompt).toContain('TypeScript, Node.js, PostgreSQL');
    });

    it('includes goals when provided', async () => {
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

      expect(capturedPrompt).toContain('Become a tech lead within 2 years');
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
          throw new Error('Request cancelled');
        }
      }

      const provider = new ErrorProvider({ apiKey: 'test' });
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow('Request cancelled');
    });
  });
});

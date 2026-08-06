import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAIProvider } from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig } from '@careeros/ai';
import { CoverLetterHandler, type CoverLetterInput } from '../cover-letter-handler.js';

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
      usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
      model: 'mock-model',
      confidence: 0.8,
      requestId: crypto.randomUUID(),
    };
  }
}

function makeInput(overrides: Partial<CoverLetterInput> = {}): CoverLetterInput {
  return {
    vacancyId: 'vacancy-1',
    vacancyTitle: 'Senior TypeScript Developer',
    vacancyDescription: 'Looking for experienced TS dev with React and Node.js',
    companyName: 'TechCorp',
    technologies: ['TypeScript', 'React', 'Node.js'],
    experienceLevel: 'senior',
    location: 'Remote',
    resumeId: 'resume-1',
    resumeText: 'Experienced developer with 5 years of TypeScript',
    structuredResume: {
      summary: 'Senior developer',
      skills: ['TypeScript', 'React'],
      technologies: ['TypeScript', 'React', 'Node.js'],
      experience: [
        { company: 'PrevCorp', position: 'Senior Dev', description: 'Built things', technologies: ['TypeScript'] },
      ],
    },
    ...overrides,
  };
}

const VALID_RESPONSE = JSON.stringify({
  coverLetter: 'Dear Hiring Manager, I am excited to apply...',
  tone: 'formal',
  keyPoints: ['5 years TypeScript experience', 'React expertise', 'Node.js background'],
});

describe('CoverLetterHandler', () => {
  let handler: CoverLetterHandler;

  beforeEach(() => {
    handler = new CoverLetterHandler();
  });

  describe('feature identifier', () => {
    it('declares cover_letter as its feature', () => {
      expect(handler.feature).toBe('cover_letter');
    });
  });

  describe('successful execution', () => {
    it('returns parsed cover letter with all fields', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const { result, usage } = await handler.execute(makeInput(), provider);

      expect(result.coverLetter).toBe('Dear Hiring Manager, I am excited to apply...');
      expect(result.tone).toBe('formal');
      expect(result.keyPoints).toEqual(['5 years TypeScript experience', 'React expertise', 'Node.js background']);
      expect(usage.totalTokens).toBe(150);
    });

    it('accepts conversational tone from provider', async () => {
      const response = JSON.stringify({ coverLetter: 'Hi there!', tone: 'conversational', keyPoints: [] });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.tone).toBe('conversational');
    });

    it('accepts technical tone from provider', async () => {
      const response = JSON.stringify({ coverLetter: 'Technical cover letter', tone: 'technical', keyPoints: ['tech'] });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.tone).toBe('technical');
    });
  });

  describe('input handling', () => {
    it('works without structuredResume (falls back to resumeText)', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const input = makeInput({ structuredResume: undefined });
      const { result } = await handler.execute(input, provider);
      expect(result.coverLetter).toBeDefined();
    });

    it('works without optional company fields', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const input = makeInput({ companyIndustry: undefined, companySize: undefined, experienceLevel: undefined, location: undefined });
      const { result } = await handler.execute(input, provider);
      expect(result.coverLetter).toBeDefined();
    });

    it('works with empty technologies array', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, VALID_RESPONSE);
      const input = makeInput({ technologies: [] });
      const { result } = await handler.execute(input, provider);
      expect(result.coverLetter).toBeDefined();
    });
  });

  describe('output parsing', () => {
    it('defaults tone to formal when provider returns invalid tone', async () => {
      const response = JSON.stringify({ coverLetter: 'letter', tone: 'invalid', keyPoints: [] });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.tone).toBe('formal');
    });

    it('defaults coverLetter to empty string when missing', async () => {
      const response = JSON.stringify({ tone: 'formal', keyPoints: [] });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.coverLetter).toBe('');
    });

    it('defaults keyPoints to empty array when missing', async () => {
      const response = JSON.stringify({ coverLetter: 'letter', tone: 'formal' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.keyPoints).toEqual([]);
    });

    it('converts non-array keyPoints to empty array', async () => {
      const response = JSON.stringify({ coverLetter: 'letter', tone: 'formal', keyPoints: 'not-an-array' });
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.keyPoints).toEqual([]);
    });

    it('extracts JSON from markdown-wrapped response', async () => {
      const response = '```json\n' + VALID_RESPONSE + '\n```';
      const provider = new MockProvider({ apiKey: 'test' }, response);
      const { result } = await handler.execute(makeInput(), provider);
      expect(result.coverLetter).toBe('Dear Hiring Manager, I am excited to apply...');
    });

    it('throws when response contains no JSON', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, 'This is plain text with no JSON');
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow('Failed to parse AI response as JSON');
    });

    it('throws when response is empty', async () => {
      const provider = new MockProvider({ apiKey: 'test' }, '');
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow();
    });
  });

  describe('prompt construction', () => {
    it('includes vacancy title and company name in prompt', async () => {
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

      expect(capturedPrompt).toContain('Senior TypeScript Developer');
      expect(capturedPrompt).toContain('TechCorp');
    });

    it('includes structured resume experience when provided', async () => {
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

      expect(capturedPrompt).toContain('PrevCorp');
      expect(capturedPrompt).toContain('Senior Dev');
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
          throw new Error('Provider unavailable');
        }
      }

      const provider = new ErrorProvider({ apiKey: 'test' });
      await expect(handler.execute(makeInput(), provider)).rejects.toThrow('Provider unavailable');
    });
  });
});

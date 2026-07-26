import type { AIProvider } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse } from '../domain/ai-types.js';
import type { StructuredResumeExtractionPromptBuilder } from '../prompts/structured-resume-extraction.js';
import type { StructuredResumeExperience, StructuredResumeEducation } from '@careeros/career';
import type { AILogger } from '../observability/ai-logger.js';
import type { AIMetricsCollector } from '../observability/ai-metrics.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import { AI_METRICS } from '../observability/ai-metrics.js';

export interface StructuredResumeExtractionResult {
  readonly summary: string;
  readonly seniorityLevel: string;
  readonly totalYearsOfExperience: number;
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly experience: readonly StructuredResumeExperience[];
  readonly education: readonly StructuredResumeEducation[];
}

export interface ResumeExtractionEngineDeps {
  readonly provider: AIProvider;
  readonly promptBuilder: StructuredResumeExtractionPromptBuilder;
  readonly logger: AILogger;
  readonly metrics: AIMetricsCollector;
}

export interface ResumeExtractionEngineConfig {
  readonly maxRetries: number;
  readonly timeoutMs: number;
}

const DEFAULT_CONFIG: ResumeExtractionEngineConfig = {
  maxRetries: 2,
  timeoutMs: 60_000,
};

export class ResumeExtractionEngine {
  private readonly config: ResumeExtractionEngineConfig;

  constructor(
    private readonly deps: ResumeExtractionEngineDeps,
    config?: Partial<ResumeExtractionEngineConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async extract(rawText: string): Promise<StructuredResumeExtractionResult> {
    const builtPrompt = this.deps.promptBuilder.build({ rawText });

    const request: AIRequest = {
      prompt: builtPrompt.user,
      promptId: builtPrompt.version.id,
      promptVersion: builtPrompt.version.version,
      promptChecksum: builtPrompt.version.checksum,
      model: this.deps.provider.defaultModel,
      systemPrompt: builtPrompt.system,
    };

    this.deps.logger.info('Starting resume extraction', {
      promptId: request.promptId,
      promptVersion: request.promptVersion,
      provider: this.deps.provider.name,
    });

    const response = await this.executeWithRetry(request);

    const result = this.parseResponse(response);

    this.recordMetrics(response);

    this.deps.logger.info('Resume extraction completed', {
      provider: response.provider,
      model: response.model,
      durationMs: response.latencyMs,
      seniorityLevel: result.seniorityLevel,
      totalYearsOfExperience: result.totalYearsOfExperience,
      skillsCount: result.skills.length,
      technologiesCount: result.technologies.length,
      experienceCount: result.experience.length,
    });

    return result;
  }

  private async executeWithRetry(request: AIRequest): Promise<AIResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.deps.provider.complete(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const aiError = error instanceof AIError ? error : undefined;

        if (aiError && !aiError.retryable) {
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          this.deps.logger.warn('AI request failed, retrying', {
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            error: lastError.message,
          });
          this.deps.metrics.incrementCounter(AI_METRICS.REQUEST_FAILED);
        }
      }
    }

    throw new AIError({
      type: AIErrorType.PROVIDER_ERROR,
      message: `Resume extraction failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
      provider: this.deps.provider.name,
      cause: lastError,
    });
  }

  private parseResponse(response: AIResponse): StructuredResumeExtractionResult {
    try {
      const parsed = JSON.parse(extractJson(response.content)) as Record<string, unknown>;

      return {
        summary: typeof parsed['summary'] === 'string' ? parsed['summary'] : '',
        seniorityLevel: validateSeniorityLevel(parsed['seniorityLevel']),
        totalYearsOfExperience: clampNumber(parsed['totalYearsOfExperience'], 0, 50),
        skills: toStringArray(parsed['skills']),
        technologies: toStringArray(parsed['technologies']),
        experience: parseExperience(parsed['experience']),
        education: parseEducation(parsed['education']),
      };
    } catch (error) {
      throw new AIError({
        type: AIErrorType.PARSE_ERROR,
        message: `Failed to parse extraction result: ${error instanceof Error ? error.message : String(error)}`,
        provider: response.provider,
      });
    }
  }

  private recordMetrics(response: AIResponse): void {
    this.deps.metrics.incrementCounter(AI_METRICS.REQUEST_COMPLETED);
    this.deps.metrics.incrementCounter(AI_METRICS.PROVIDER_SUCCESS, 1, {
      provider: response.provider,
    });
    this.deps.metrics.incrementCounter(AI_METRICS.MODEL_REQUEST, 1, {
      model: response.model,
      provider: response.provider,
    });
    this.deps.metrics.recordHistogram(AI_METRICS.REQUEST_DURATION, response.latencyMs);
    this.deps.metrics.recordHistogram(AI_METRICS.TOKENS_TOTAL, response.usage.totalTokens);
    this.deps.metrics.recordHistogram(AI_METRICS.TOKENS_PROMPT, response.usage.promptTokens);
    this.deps.metrics.recordHistogram(AI_METRICS.TOKENS_COMPLETION, response.usage.completionTokens);
  }
}

function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced?.[1] ?? content;
}

function clampNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number') return min;
  return Math.max(min, Math.min(max, value));
}

function validateSeniorityLevel(value: unknown): string {
  const valid = ['junior', 'mid', 'senior', 'lead', 'executive'];
  if (typeof value === 'string' && valid.includes(value.toLowerCase())) {
    return value.toLowerCase();
  }
  return 'mid';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function parseExperience(raw: unknown): StructuredResumeExperience[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return {
        company: '',
        position: '',
        startDate: new Date(),
        description: '',
        technologies: [],
      };
    }
    const obj = item as Record<string, unknown>;
    return {
      company: typeof obj['company'] === 'string' ? obj['company'] : '',
      position: typeof obj['position'] === 'string' ? obj['position'] : '',
      startDate: parseDate(obj['startDate']),
      endDate: obj['endDate'] ? parseDate(obj['endDate']) : undefined,
      description: typeof obj['description'] === 'string' ? obj['description'] : '',
      technologies: toStringArray(obj['technologies']),
    };
  });
}

function parseEducation(raw: unknown): StructuredResumeEducation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return {
        institution: '',
        degree: '',
        field: '',
        startDate: new Date(),
      };
    }
    const obj = item as Record<string, unknown>;
    return {
      institution: typeof obj['institution'] === 'string' ? obj['institution'] : '',
      degree: typeof obj['degree'] === 'string' ? obj['degree'] : '',
      field: typeof obj['field'] === 'string' ? obj['field'] : '',
      startDate: parseDate(obj['startDate']),
      endDate: obj['endDate'] ? parseDate(obj['endDate']) : undefined,
    };
  });
}

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

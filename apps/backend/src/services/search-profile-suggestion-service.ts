import { createResumeId, createStructuredResumeId } from '@careeros/career';
import type { ResumeRepository, StructuredResumeRepository, ExperienceLevel } from '@careeros/career';
import { ExperienceLevel as ExperienceLevelEnum, StructuredResume } from '@careeros/career';
import {
  SearchProfileSuggestionPromptBuilder,
  ResumeContextProviderImpl,
  ResumeExtractionEngine,
  AIError,
  estimateCost,
  getModelPricing,
} from '@careeros/ai';
import type { AIProvider, AIRequest, AIResponse, ResumeContextProvider, UsageRecorder } from '@careeros/ai';
import type { BudgetEnforcer } from '@careeros/ai-orchestrator';
import type { Logger } from '@careeros/providers';
import { ConsoleLogger } from '@careeros/providers';
import { buildCompactResumeContext, estimateTokens } from './resume-context-builder.js';

export type RemotePreference = 'remote' | 'hybrid' | 'onsite' | null;

export interface SearchProfileSuggestion {
  readonly desiredPositions: readonly string[];
  readonly technologies: readonly string[];
  readonly experienceLevel: ExperienceLevel;
  readonly remotePreference: RemotePreference;
  readonly confidence: number;
  readonly reasoning: string;
}

export class ResumeNotFoundForSuggestionError extends Error {
  constructor(id: string) {
    super(`Resume '${id}' not found`);
    this.name = 'ResumeNotFoundForSuggestionError';
  }
}

export class ResumeNotAuthorizedForSuggestionError extends Error {
  constructor(id: string) {
    super(`Resume '${id}' does not belong to this user`);
    this.name = 'ResumeNotAuthorizedForSuggestionError';
  }
}

export class ResumeTextUnavailableError extends Error {
  constructor(id: string) {
    super(`Resume '${id}' has no extracted text to analyze`);
    this.name = 'ResumeTextUnavailableError';
  }
}

export class SearchProfileSuggestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchProfileSuggestionError';
  }
}

/**
 * Thrown when the AI provider call itself fails (rate limit, timeout, network,
 * outage). Distinct from SearchProfileSuggestionError, which covers a provider
 * response we couldn't parse — this is never the caller's fault.
 */
export class SearchProfileSuggestionUnavailableError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'SearchProfileSuggestionUnavailableError';
    this.retryable = retryable;
  }
}

const VALID_EXPERIENCE_LEVELS = new Set<string>(Object.values(ExperienceLevelEnum));
const VALID_REMOTE_PREFERENCES = new Set(['remote', 'hybrid', 'onsite']);
const MAX_LIST_ITEMS = 15;

/**
 * Groq's free tier caps llama-3.1-8b-instant at 6000 tokens per minute
 * (TPM) *per request* including the reserved completion budget, and resume
 * text tokenizes far less efficiently than plain English when it contains
 * non-Latin script (Cyrillic, CJK, etc. can run close to 1 token per 1-2
 * chars vs ~4 chars/token for English). This is the primary control —
 * buildCompactResumeContext() enforces it via a real token estimate, not a
 * character count.
 */
const MAX_RESUME_CONTEXT_TOKENS = 1800;

/**
 * The suggestion response is a small, fixed-shape JSON object, so there is no
 * reason to reserve the provider's default 4000-token completion budget —
 * that reservation alone was consuming most of Groq's 6000 TPM limit and was
 * the dominant cause of the observed 413s.
 */
const MAX_SUGGESTION_COMPLETION_TOKENS = 700;

export class SearchProfileSuggestionService {
  private readonly contextProvider: ResumeContextProvider;

  constructor(
    private readonly resumeRepository: ResumeRepository,
    private readonly provider: AIProvider,
    private readonly structuredResumeRepository: StructuredResumeRepository,
    private readonly extractionEngine: ResumeExtractionEngine | null = null,
    private readonly extractionVersion: string = '1.0.0',
    private readonly promptBuilder: SearchProfileSuggestionPromptBuilder = new SearchProfileSuggestionPromptBuilder(),
    // Optional — when unset, no budget cap is enforced on this call site.
    private readonly budgetEnforcer?: BudgetEnforcer,
    // Optional — when unset, this call site's usage never reaches the AI dashboard
    // (see UsageRecorder doc comment for why that matters).
    private readonly usageRecorder?: UsageRecorder,
    private readonly logger: Logger = new ConsoleLogger()
  ) {
    this.contextProvider = new ResumeContextProviderImpl({
      resumeRepository,
      structuredResumeRepository,
      extractionVersion,
      fallbackContextBuilder: buildCompactResumeContext,
      tokenEstimator: estimateTokens,
    });
  }

  async suggest(params: { userId: string; resumeId: string }): Promise<SearchProfileSuggestion> {
    const resume = await this.resumeRepository.findById(createResumeId(params.resumeId));
    if (!resume) {
      throw new ResumeNotFoundForSuggestionError(params.resumeId);
    }
    if (resume.userId !== params.userId) {
      throw new ResumeNotAuthorizedForSuggestionError(params.resumeId);
    }

    const rawText = resume.rawText;
    if (!rawText || rawText.trim().length === 0) {
      throw new ResumeTextUnavailableError(params.resumeId);
    }

    const resumeId = createResumeId(params.resumeId);
    const context = await this.contextProvider.getContext(resumeId, MAX_RESUME_CONTEXT_TOKENS);

    if (context.source === 'fallback_raw' && this.extractionEngine) {
      await this.extractAndSave(this.extractionEngine, resumeId, rawText, params.userId);
    }

    if (this.budgetEnforcer) {
      const budgetCheck = await this.budgetEnforcer.checkBudget(params.userId, 'search_profile_suggestion');
      if (!budgetCheck.allowed) {
        throw new SearchProfileSuggestionUnavailableError(
          'The AI suggestion service budget for this period has been reached',
          false
        );
      }
    }

    const builtPrompt = this.promptBuilder.build({ resumeRawText: context.promptText });
    const request: AIRequest = {
      prompt: builtPrompt.user,
      promptId: builtPrompt.version.id,
      promptVersion: builtPrompt.version.version,
      promptChecksum: builtPrompt.version.checksum,
      model: this.provider.defaultModel,
      systemPrompt: builtPrompt.system,
      maxTokens: MAX_SUGGESTION_COMPLETION_TOKENS,
    };

    let content: string;
    try {
      const response = await this.provider.complete(request);
      content = response.content;
      this.recordUsage(response, params.userId);
    } catch (error) {
      this.logger.error('Search profile suggestion: AI provider call failed', error instanceof Error ? error : undefined);
      const retryable = error instanceof AIError ? error.retryable : false;
      throw new SearchProfileSuggestionUnavailableError(
        'The AI suggestion service is temporarily unavailable',
        retryable
      );
    }

    return this.parseSuggestion(content);
  }

  private async extractAndSave(extractionEngine: ResumeExtractionEngine, resumeId: ReturnType<typeof createResumeId>, rawText: string, userId: string): Promise<void> {
    try {
      if (this.budgetEnforcer) {
        const budgetCheck = await this.budgetEnforcer.checkBudget(userId, 'resume_extraction');
        if (!budgetCheck.allowed) {
          this.logger.warn('Search profile suggestion: resume extraction skipped, budget limit reached', { userId, reason: budgetCheck.reason });
          return;
        }
      }

      const result = await extractionEngine.extract(rawText, userId);
      const sourceHash = this.computeHash(rawText);
      const structuredResume = StructuredResume.create({
        id: createStructuredResumeId(crypto.randomUUID()),
        resumeId,
        sourceHash,
        extractionVersion: this.extractionVersion,
      });

      structuredResume.markCompleted({
        summary: result.summary,
        seniorityLevel: result.seniorityLevel,
        totalYearsOfExperience: result.totalYearsOfExperience,
        skills: result.skills,
        technologies: result.technologies,
        experience: result.experience,
        education: result.education,
        certifications: result.certifications,
        languages: result.languages,
      });

      await this.structuredResumeRepository.upsert(structuredResume);
    } catch (error) {
      this.logger.error('Search profile suggestion: extraction failed, continuing with fallback', error instanceof Error ? error : undefined);
    }
  }

  private recordUsage(response: AIResponse, userId: string): void {
    try {
      const pending = this.usageRecorder?.record({
        userId,
        provider: response.provider,
        model: response.model,
        feature: 'search_profile_suggestion',
        tokensIn: response.usage.promptTokens,
        tokensOut: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        estimatedCost: estimateCost(response.usage, getModelPricing(response.provider, response.model)),
        latencyMs: response.latencyMs,
      });
      if (pending) {
        void Promise.resolve(pending).catch((error) => {
          this.logger.error('Search profile suggestion: failed to record usage', error instanceof Error ? error : undefined);
        });
      }
    } catch (error) {
      this.logger.error('Search profile suggestion: failed to record usage', error instanceof Error ? error : undefined);
    }
  }

  private computeHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash.toString(16);
  }

  private parseSuggestion(content: string): SearchProfileSuggestion {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJson(content)) as Record<string, unknown>;
    } catch (error) {
      throw new SearchProfileSuggestionError(
        `Failed to parse AI suggestion response: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      desiredPositions: toStringArray(parsed['desiredPositions']),
      technologies: toStringArray(parsed['technologies']),
      experienceLevel: toExperienceLevel(parsed['experienceLevel']),
      remotePreference: toRemotePreference(parsed['remotePreference']),
      confidence: clampNumber(parsed['confidence'], 0, 1),
      reasoning: typeof parsed['reasoning'] === 'string' ? parsed['reasoning'] : '',
    };
  }
}

function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced?.[1] ?? content;
}

function clampNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, MAX_LIST_ITEMS);
}

function toExperienceLevel(value: unknown): ExperienceLevel {
  if (typeof value === 'string' && VALID_EXPERIENCE_LEVELS.has(value)) {
    return value as ExperienceLevel;
  }
  return ExperienceLevelEnum.MIDDLE;
}

function toRemotePreference(value: unknown): RemotePreference {
  if (typeof value === 'string' && VALID_REMOTE_PREFERENCES.has(value)) {
    return value as RemotePreference;
  }
  return null;
}

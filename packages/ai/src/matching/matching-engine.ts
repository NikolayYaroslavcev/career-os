import type { AIProvider } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse } from '../domain/ai-types.js';
import type { MatchResult } from '../domain/match-result.js';
import { createMatchResult } from '../domain/match-result.js';
import type { CategoryScore, ActionableItem, MatchExplanation, MatchCategory } from '../domain/match-category.js';
import { ALL_MATCH_CATEGORIES } from '../domain/match-category.js';
import type { PromptBuilder } from '../prompts/prompt-builder.js';
import type { AICache } from '../cache/ai-cache.js';
import type { CostTracker } from '../cost/cost-tracker.js';
import { estimateCost } from '../cost/cost-tracker.js';
import { getModelPricing } from '../cost/pricing.js';
import type { UsageRecorder } from '../cost/usage-recorder.js';
import type { AILogger } from '../observability/ai-logger.js';
import type { AIMetricsCollector } from '../observability/ai-metrics.js';
import type { AITracer } from '../observability/ai-tracer.js';
import { computePromptHash } from '../cache/prompt-hash.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import { AI_METRICS } from '../observability/ai-metrics.js';
import { CURRENT_MATCHING_ALGORITHM_VERSION } from './matching-algorithm-version.js';

export interface MatchingEngineConfig {
  readonly enableCache: boolean;
  readonly cacheTtlMs: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  /** Base delay for exponential backoff between retries (doubles each attempt). */
  readonly retryBaseDelayMs: number;
  /** Upper bound on any single retry delay, including provider-supplied `retryAfterMs`. */
  readonly retryMaxDelayMs: number;
}

export interface MatchingEngineDeps {
  readonly provider: AIProvider;
  readonly promptBuilder: PromptBuilder<MatchParams>;
  readonly cache: AICache;
  readonly costTracker: CostTracker;
  readonly logger: AILogger;
  readonly metrics: AIMetricsCollector;
  readonly tracer: AITracer;
  /**
   * Persists usage to AIUsageRepository so vacancy-matching calls (which bypass
   * AIOrchestrator.execute()) still show up in the AI usage dashboard. Optional
   * so existing tests/callers that construct MatchingEngine directly keep working.
   */
  readonly usageRecorder?: UsageRecorder;
}

export interface MatchParams {
  readonly searchProfileId: string;
  /** Id of the MatchResult being refreshed, when re-analyzing an existing (searchProfile, vacancy) pair — keeps the row's id (and any Application.matchResultId referencing it) stable across re-analysis instead of minting a new one. */
  readonly existingId?: string;
  /** Absent when this is a profile-only analysis (no resume available yet). */
  readonly resumeId?: string;
  readonly vacancyId: string;
  readonly userId: string;
  /** Fingerprint of the vacancy/profile/resume inputs — carried through to the persisted MatchResult so reuse checks can detect staleness. */
  readonly inputHash: string;
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly technologies: readonly string[];
  readonly experienceLevel?: string;
  readonly salaryRange?: string;
  readonly location?: string;
  readonly desiredPositions?: readonly string[];
  readonly desiredTechnologies?: readonly string[];
  readonly desiredExperienceLevel?: string;
  readonly isRemoteOnly?: boolean;
  readonly desiredLocations?: readonly string[];
  readonly resumeSummary?: string;
  readonly resumeSkills?: readonly string[];
  readonly resumeTechnologies?: readonly string[];
  readonly yearsOfExperience?: number;
  readonly resumeRawText?: string;
}

const DEFAULT_CONFIG: MatchingEngineConfig = {
  enableCache: true,
  cacheTtlMs: 60 * 60 * 1000,
  maxRetries: 2,
  timeoutMs: 60_000,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 20_000,
};

export class MatchingEngine {
  private readonly config: MatchingEngineConfig;

  constructor(
    private readonly deps: MatchingEngineDeps,
    config?: Partial<MatchingEngineConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async match(params: MatchParams): Promise<MatchResult> {
    const span = this.deps.tracer.startSpan('matching-engine.match', {
      promptId: this.deps.promptBuilder.promptId,
      provider: this.deps.provider.name,
    });

    try {
      const builtPrompt = this.deps.promptBuilder.build(params);

      const request: AIRequest = {
        prompt: builtPrompt.user,
        promptId: builtPrompt.version.id,
        promptVersion: builtPrompt.version.version,
        promptChecksum: builtPrompt.version.checksum,
        model: this.deps.provider.defaultModel,
        systemPrompt: builtPrompt.system,
      };

      span.setAttribute('promptId', request.promptId);
      span.setAttribute('promptVersion', request.promptVersion);

      let response: AIResponse;

      if (this.config.enableCache) {
        const hash = computePromptHash(request);
        const cached = await this.deps.cache.get(hash);
        if (cached) {
          this.deps.logger.info('Cache hit for AI request', {
            promptId: request.promptId,
            cached: true,
          });
          this.deps.metrics.incrementCounter(AI_METRICS.CACHE_HIT);
          response = cached.response;
          span.setAttribute('cached', true);
        } else {
          this.deps.metrics.incrementCounter(AI_METRICS.CACHE_MISS);
          response = await this.executeWithRetry(request, span);
          await this.deps.cache.set(hash, response, this.config.cacheTtlMs);
          span.setAttribute('cached', false);
        }
      } else {
        response = await this.executeWithRetry(request, span);
      }

      const result = this.parseMatchResult(response, request, params);

      this.recordMetrics(response, result, request);

      this.deps.logger.info('Match completed', {
        provider: response.provider,
        model: response.model,
        confidence: result.confidence,
        overallScore: result.overallScore,
        recommendation: result.recommendation,
        durationMs: response.latencyMs,
      });

      span.setAttribute('overallScore', result.overallScore);
      span.setAttribute('confidence', result.confidence);
      span.setAttribute('recommendation', result.recommendation);

      return result;
    } catch (error) {
      span.setAttribute('error', true);
      this.deps.metrics.incrementCounter(AI_METRICS.PROVIDER_FAILURE, 1, {
        provider: this.deps.provider.name,
      });
      this.deps.logger.error('Match failed', error instanceof Error ? error : undefined);
      throw error;
    } finally {
      span.end();
    }
  }

  private async executeWithRetry(request: AIRequest, span: { addEvent: (name: string, attrs?: Record<string, string | number | boolean>) => void }): Promise<AIResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        span.addEvent('ai_request_attempt', { attempt: attempt + 1 });
        return await this.deps.provider.complete(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const aiError = error instanceof AIError ? error : undefined;

        if (aiError && !aiError.retryable) {
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          const delayMs = this.calculateRetryDelay(attempt, aiError);
          this.deps.logger.warn('AI request failed, retrying', {
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            error: lastError.message,
            delayMs,
          });
          this.deps.metrics.incrementCounter(AI_METRICS.REQUEST_FAILED);
          await this.sleep(delayMs);
        }
      }
    }

    // Rethrow the original error (e.g. RATE_LIMITED) rather than masking it as a
    // generic PROVIDER_ERROR, so callers can still see why the AI call failed.
    if (lastError instanceof AIError) {
      throw lastError;
    }

    throw new AIError({
      type: AIErrorType.PROVIDER_ERROR,
      message: `AI request failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
      provider: this.deps.provider.name,
      cause: lastError,
    });
  }

  /**
   * Exponential backoff with jitter, honoring the provider's own `retryAfterMs`
   * hint (e.g. Groq's `Retry-After` header) when one is available. Without this,
   * an immediate same-window retry against a per-minute token budget (TPM) just
   * fails again for the same reason.
   */
  private calculateRetryDelay(attempt: number, aiError?: AIError): number {
    if (aiError?.retryAfterMs && aiError.retryAfterMs > 0) {
      return Math.min(aiError.retryAfterMs, this.config.retryMaxDelayMs);
    }

    const exponential = this.config.retryBaseDelayMs * Math.pow(2, attempt);
    const jittered = exponential * (0.5 + Math.random() * 0.5);
    return Math.min(Math.floor(jittered), this.config.retryMaxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseMatchResult(
    response: AIResponse,
    request: AIRequest,
    params: MatchParams,
  ): MatchResult {
    try {
      const parsed = JSON.parse(extractJson(response.content)) as Record<string, unknown>;

      const categoryScores = parseCategoryScores(parsed['categoryScores']);
      const actionableItems = parseActionableItems(parsed['actionableItems']);
      const explanation = parseMatchExplanation(parsed['explanation']);

      const overallScore = categoryScores.length > 0
        ? computeWeightedScore(categoryScores)
        : clampNumber(parsed['overallScore'], 0, 100);

      return createMatchResult({
        id: params.existingId,
        searchProfileId: params.searchProfileId,
        resumeId: params.resumeId,
        vacancyId: params.vacancyId,
        userId: params.userId,
        overallScore,
        confidence: clampNumber(parsed['confidence'], 0, 1),
        recommendation: validateRecommendation(parsed['recommendation']),
        summary: typeof parsed['summary'] === 'string' ? parsed['summary'] : '',
        strengths: toStringArray(parsed['strengths']),
        weaknesses: toStringArray(parsed['weaknesses']),
        requiredSkills: toStringArray(parsed['requiredSkills']),
        missingSkills: toStringArray(parsed['missingSkills']),
        seniorityEstimation: typeof parsed['seniorityEstimation'] === 'string' ? parsed['seniorityEstimation'] : '',
        remotePolicy: typeof parsed['remotePolicy'] === 'string' ? parsed['remotePolicy'] : '',
        salaryObservations: typeof parsed['salaryObservations'] === 'string' ? parsed['salaryObservations'] : null,
        salaryFit: parseFitAssessment(parsed['salaryFit']),
        locationFit: parseFitAssessment(parsed['locationFit']),
        experienceFit: parseFitAssessment(parsed['experienceFit']),
        careerGrowthFit: parseFitAssessment(parsed['careerGrowthFit']),
        reasoning: typeof parsed['reasoning'] === 'string' ? parsed['reasoning'] : '',
        categoryScores,
        actionableItems,
        explanation,
        model: response.model,
        provider: response.provider,
        promptVersion: request.promptVersion,
        promptId: request.promptId,
        matchingAlgorithmVersion: CURRENT_MATCHING_ALGORITHM_VERSION,
        inputHash: params.inputHash,
        tokenUsage: response.usage,
        latencyMs: response.latencyMs,
        estimatedCostUsd: estimateCost(response.usage, getModelPricing(response.provider, response.model)),
      });
    } catch (error) {
      throw new AIError({
        type: AIErrorType.PARSE_ERROR,
        message: `Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`,
        provider: response.provider,
      });
    }
  }

  private recordMetrics(response: AIResponse, result: MatchResult, request: AIRequest): void {
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
    this.deps.metrics.recordHistogram(AI_METRICS.MATCH_SCORE_DISTRIBUTION, result.overallScore);
    this.deps.metrics.recordHistogram(AI_METRICS.CONFIDENCE_DISTRIBUTION, result.confidence);
    this.deps.metrics.recordHistogram(AI_METRICS.COST_USD, result.estimatedCostUsd);

    this.deps.costTracker.record({
      requestId: response.requestId,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      estimatedCostUsd: result.estimatedCostUsd,
      latencyMs: response.latencyMs,
      promptId: request.promptId,
      promptVersion: request.promptVersion,
    });

    this.recordUsage(response, result);
  }

  private recordUsage(response: AIResponse, result: MatchResult): void {
    try {
      const pending = this.deps.usageRecorder?.record({
        userId: result.userId,
        provider: response.provider,
        model: response.model,
        feature: 'vacancy_matching',
        tokensIn: response.usage.promptTokens,
        tokensOut: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        estimatedCost: result.estimatedCostUsd,
        latencyMs: response.latencyMs,
      });
      if (pending) {
        void Promise.resolve(pending).catch((error) => {
          this.deps.logger.warn('Failed to record vacancy_matching usage', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch (error) {
      this.deps.logger.warn('Failed to record vacancy_matching usage', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

function validateRecommendation(value: unknown): 'StrongApply' | 'Apply' | 'Maybe' | 'Skip' {
  const valid: readonly string[] = ['StrongApply', 'Apply', 'Maybe', 'Skip'];
  if (typeof value === 'string' && valid.includes(value)) {
    return value as 'StrongApply' | 'Apply' | 'Maybe' | 'Skip';
  }
  return 'Maybe';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function parseFitAssessment(value: unknown): { score: number; confidence: number; reasoning: string } {
  if (typeof value !== 'object' || value === null) {
    return { score: 50, confidence: 0.5, reasoning: 'No data available' };
  }
  const obj = value as Record<string, unknown>;
  return {
    score: clampNumber(obj['score'], 0, 100),
    confidence: clampNumber(obj['confidence'], 0, 1),
    reasoning: typeof obj['reasoning'] === 'string' ? obj['reasoning'] : '',
  };
}

const VALID_CATEGORIES: readonly string[] = ALL_MATCH_CATEGORIES;

function parseCategoryScores(value: unknown): CategoryScore[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && typeof item['category'] === 'string' && VALID_CATEGORIES.includes(item['category']),
    )
    .map((item) => ({
      category: item['category'] as MatchCategory,
      label: typeof item['label'] === 'string' ? item['label'] : String(item['category']),
      value: clampNumber(item['value'], 0, 100),
      weight: clampNumber(item['weight'], 0, 1),
      confidence: clampNumber(item['confidence'], 0, 1),
      explanation: typeof item['explanation'] === 'string' ? item['explanation'] : '',
    }));
}

function parseActionableItems(value: unknown): ActionableItem[] {
  if (!Array.isArray(value)) return [];
  const validTypes: readonly string[] = ['add_skill', 'mention_keyword', 'gain_experience', 'adjust_expectation'];
  const validPriorities: readonly string[] = ['high', 'medium', 'low'];
  return value
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      type: validTypes.includes(String(item['type'])) ? item['type'] as ActionableItem['type'] : 'add_skill',
      title: typeof item['title'] === 'string' ? item['title'] : '',
      description: typeof item['description'] === 'string' ? item['description'] : '',
      impact: clampNumber(item['impact'], 0, 50),
      category: VALID_CATEGORIES.includes(String(item['category'])) ? item['category'] as MatchCategory : 'technical_skills',
      priority: validPriorities.includes(String(item['priority'])) ? item['priority'] as ActionableItem['priority'] : 'medium',
    }));
}

function parseMatchExplanation(value: unknown): MatchExplanation | null {
  if (typeof value !== 'object' || value === null) return null;
  const obj = value as Record<string, unknown>;
  return {
    overallPercent: clampNumber(obj['overallPercent'], 0, 100),
    strengths: parseExplanationItems(obj['strengths']),
    weaknesses: parseExplanationItems(obj['weaknesses']),
    missingKeywords: toStringArray(obj['missingKeywords']),
    categoryScores: parseCategoryScores(obj['categoryScores']),
  };
}

function parseExplanationItems(value: unknown): ReadonlyArray<{ label: string; detail: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      label: typeof item['label'] === 'string' ? item['label'] : '',
      detail: typeof item['detail'] === 'string' ? item['detail'] : '',
    }));
}

function computeWeightedScore(categoryScores: readonly CategoryScore[]): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const cs of categoryScores) {
    weightedSum += cs.value * cs.weight;
    weightSum += cs.weight;
  }
  if (weightSum === 0) return 0;
  return Math.round((weightedSum / weightSum) * 100) / 100;
}

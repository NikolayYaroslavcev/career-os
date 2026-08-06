import { ZodError } from 'zod';
import type { SocialMessage } from '@careeros/career';
import type { AIProvider } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse } from '../domain/ai-types.js';
import type { PromptBuilder } from '../prompts/prompt-builder.js';
import type { MessageExtractionPromptParams } from '../prompts/message-extraction.js';
import type { AICache } from '../cache/ai-cache.js';
import type { CostTracker } from '../cost/cost-tracker.js';
import { estimateCost } from '../cost/cost-tracker.js';
import { getModelPricing } from '../cost/pricing.js';
import type { AILogger } from '../observability/ai-logger.js';
import type { AIMetricsCollector } from '../observability/ai-metrics.js';
import type { AITracer, AISpan } from '../observability/ai-tracer.js';
import { AI_METRICS } from '../observability/ai-metrics.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import { computeMessageExtractionCacheKey } from './message-extraction-cache-key.js';
import { computeMessageExtractionConfidence, classifyMessageExtractionStatus } from './message-extraction-confidence.js';
import { extractedVacancyFieldsSchema, type ExtractedVacancyFields } from './social-message-extraction-schema.js';
import type { MessageExtraction, MessageExtractionInput } from '../domain/message-extraction.js';
import { MessageExtractionStatus, createMessageExtraction } from '../domain/message-extraction.js';
import type { MessageExtractionRepository } from '../domain/message-extraction-repository.js';

export interface MessageExtractionEngineConfig {
  readonly enableCache: boolean;
  readonly cacheTtlMs: number;
  readonly maxRetries: number;
  /** Base delay for exponential backoff between retries (doubles each attempt). */
  readonly retryBaseDelayMs: number;
  /** Upper bound on any single retry delay, including provider-supplied `retryAfterMs`. */
  readonly retryMaxDelayMs: number;
}

export interface MessageExtractionEngineDeps {
  readonly provider: AIProvider;
  readonly promptBuilder: PromptBuilder<MessageExtractionPromptParams>;
  readonly repository: MessageExtractionRepository;
  readonly cache: AICache;
  readonly costTracker: CostTracker;
  readonly logger: AILogger;
  readonly metrics: AIMetricsCollector;
  readonly tracer: AITracer;
}

export interface MessageExtractionOutcome {
  readonly extraction: MessageExtraction;
  /** True when an existing row for this exact (contentHash, provider, model, promptChecksum) was reused — no AI call, no new row. */
  readonly reused: boolean;
}

const DEFAULT_CONFIG: MessageExtractionEngineConfig = {
  enableCache: true,
  cacheTtlMs: 60 * 60 * 1000,
  maxRetries: 2,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 20_000,
};

const EMPTY_TOKEN_USAGE = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

type ExtractionAttempt =
  | {
      readonly kind: 'success';
      readonly response: AIResponse;
      readonly fields: ExtractedVacancyFields;
      readonly aiSelfReportedConfidence?: number;
      readonly fromCache: boolean;
    }
  | {
      readonly kind: 'failure';
      readonly status: typeof MessageExtractionStatus.PARSE_ERROR | typeof MessageExtractionStatus.PROVIDER_ERROR;
      readonly errorMessage: string;
      readonly response?: AIResponse;
    };

/**
 * Transforms a SocialMessage into a validated, deterministically-confidence-scored
 * MessageExtraction, and persists it. Nothing else (ADR-032 Phase 3): no
 * Telegram-specific logic, no Vacancy normalization, no deduplication, no
 * recommendation updates. Reuses the same AI orchestration primitives every
 * other engine in this package uses (AIProvider, AICache, CostTracker,
 * AILogger/AIMetricsCollector/AITracer) rather than building a parallel
 * execution path — see MatchingEngine for the sibling implementation this one
 * mirrors. Deliberately does NOT use UsageRecorder/AIUsageRepository like
 * MatchingEngine/ResumeExtractionEngine do: AIUsage.userId is a hard FK to
 * User, and message extraction runs against public channel content with no
 * owning user — cost/token observability here goes through CostTracker and
 * AI_METRICS instead, which need no user attribution.
 */
export class MessageExtractionEngine {
  private readonly config: MessageExtractionEngineConfig;

  constructor(
    private readonly deps: MessageExtractionEngineDeps,
    config?: Partial<MessageExtractionEngineConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async extract(message: SocialMessage): Promise<MessageExtractionOutcome> {
    const span = this.deps.tracer.startSpan('message-extraction-engine.extract', {
      promptId: this.deps.promptBuilder.promptId,
      provider: this.deps.provider.name,
      messageId: message.id,
    });

    try {
      const builtPrompt = this.deps.promptBuilder.build({ rawText: message.rawText });
      const model = this.deps.provider.defaultModel;

      span.setAttribute('promptId', builtPrompt.version.id);
      span.setAttribute('promptVersion', builtPrompt.version.version);

      const existing = await this.deps.repository.findByContentHashAndPrompt(
        message.contentHash,
        this.deps.provider.name,
        model,
        builtPrompt.version.checksum,
      );
      if (existing) {
        this.deps.logger.info('Message extraction reused (idempotent replay)', {
          promptId: builtPrompt.version.id,
          provider: this.deps.provider.name,
        });
        this.deps.metrics.incrementCounter(AI_METRICS.EXTRACTION_REUSED);
        span.setAttribute('reused', true);
        return { extraction: existing, reused: true };
      }

      const request: AIRequest = {
        prompt: builtPrompt.user,
        promptId: builtPrompt.version.id,
        promptVersion: builtPrompt.version.version,
        promptChecksum: builtPrompt.version.checksum,
        model,
        systemPrompt: builtPrompt.system,
      };

      const cacheKey = this.config.enableCache
        ? computeMessageExtractionCacheKey({
            contentHash: message.contentHash,
            provider: this.deps.provider.name,
            model,
            promptChecksum: request.promptChecksum,
          })
        : undefined;

      const attempt = await this.runExtraction(request, cacheKey, span);
      const input = this.buildExtractionInput(message, request, attempt);
      const saved = await this.deps.repository.save(createMessageExtraction(input));

      this.recordMetrics(attempt.kind === 'success' ? attempt.response : undefined, saved, request);

      this.deps.logger.info('Message extraction completed', {
        provider: this.deps.provider.name,
        model,
        status: saved.status,
        cached: attempt.kind === 'success' ? attempt.fromCache : false,
        durationMs: saved.latencyMs,
      });

      span.setAttribute('status', saved.status);
      span.setAttribute('deterministicConfidence', saved.deterministicConfidence);

      return { extraction: saved, reused: false };
    } catch (error) {
      span.setAttribute('error', true);
      this.deps.metrics.incrementCounter(AI_METRICS.PROVIDER_FAILURE, 1, {
        provider: this.deps.provider.name,
      });
      this.deps.logger.error('Message extraction failed', error instanceof Error ? error : undefined, {
        messageId: message.id,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * A cache hit is only ever written after a response has already passed
   * schema validation once (see the success branch below), so a hit never
   * needs re-validation or retries — it's replayed as-is. Anything else goes
   * through the full validate-or-retry loop, where a malformed/invalid
   * response is itself retryable (unlike a hard provider error), because an
   * LLM producing bad JSON on one attempt and good JSON on the next is common
   * — this is the one place this engine's retry policy intentionally differs
   * from MatchingEngine/ResumeExtractionEngine.
   */
  private async runExtraction(request: AIRequest, cacheKey: string | undefined, span: AISpan): Promise<ExtractionAttempt> {
    if (cacheKey) {
      const cached = await this.deps.cache.get(cacheKey);
      if (cached) {
        const parsed = this.tryParseAndValidate(cached.response.content);
        if (parsed) {
          this.deps.logger.info('Cache hit for message extraction', { cached: true });
          this.deps.metrics.incrementCounter(AI_METRICS.CACHE_HIT);
          span.setAttribute('cached', true);
          return { kind: 'success', response: cached.response, fields: parsed.fields, aiSelfReportedConfidence: parsed.aiSelfReportedConfidence, fromCache: true };
        }
      }
      this.deps.metrics.incrementCounter(AI_METRICS.CACHE_MISS);
      span.setAttribute('cached', false);
    }

    let lastResponse: AIResponse | undefined;
    let lastError: Error | undefined;
    let lastErrorIsParseFailure = false;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        span.addEvent('ai_request_attempt', { attempt: attempt + 1 });
        const response = await this.deps.provider.complete(request);
        lastResponse = response;

        const parsed = this.tryParseAndValidate(response.content);
        if (!parsed) {
          throw new AIError({
            type: AIErrorType.PARSE_ERROR,
            message: 'Message extraction response failed schema validation',
            provider: response.provider,
            retryable: true,
          });
        }

        if (cacheKey) {
          await this.deps.cache.set(cacheKey, response, this.config.cacheTtlMs);
        }

        return { kind: 'success', response, fields: parsed.fields, aiSelfReportedConfidence: parsed.aiSelfReportedConfidence, fromCache: false };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const aiError = error instanceof AIError ? error : undefined;
        lastErrorIsParseFailure = aiError?.type === AIErrorType.PARSE_ERROR;

        if (aiError && !aiError.retryable) {
          break;
        }

        if (attempt < this.config.maxRetries) {
          const delayMs = this.calculateRetryDelay(attempt, aiError);
          this.deps.logger.warn('Message extraction attempt failed, retrying', {
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

    return {
      kind: 'failure',
      status: lastErrorIsParseFailure ? MessageExtractionStatus.PARSE_ERROR : MessageExtractionStatus.PROVIDER_ERROR,
      errorMessage: lastError?.message ?? 'Message extraction failed for an unknown reason',
      response: lastResponse,
    };
  }

  private tryParseAndValidate(content: string): { fields: ExtractedVacancyFields; aiSelfReportedConfidence?: number } | undefined {
    try {
      const raw = JSON.parse(extractJson(content)) as Record<string, unknown>;
      const fields = extractedVacancyFieldsSchema.parse(raw);
      const aiSelfReportedConfidence = typeof raw['confidence'] === 'number'
        ? Math.max(0, Math.min(1, raw['confidence']))
        : undefined;
      return { fields, aiSelfReportedConfidence };
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
        return undefined;
      }
      throw error;
    }
  }

  private buildExtractionInput(message: SocialMessage, request: AIRequest, attempt: ExtractionAttempt): MessageExtractionInput {
    const shared = {
      messageId: message.id,
      provider: this.deps.provider.name,
      model: request.model ?? this.deps.provider.defaultModel,
      promptId: request.promptId,
      promptVersion: request.promptVersion,
      promptChecksum: request.promptChecksum,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      language: message.language,
      contentHash: message.contentHash,
    };

    if (attempt.kind === 'failure') {
      return {
        ...shared,
        extractedFields: extractedVacancyFieldsSchema.parse({}),
        deterministicConfidence: 0,
        missingFields: [],
        status: attempt.status,
        errorMessage: attempt.errorMessage,
        tokenUsage: attempt.response?.usage ?? EMPTY_TOKEN_USAGE,
        estimatedCostUsd: attempt.response
          ? estimateCost(attempt.response.usage, getModelPricing(attempt.response.provider, attempt.response.model))
          : 0,
        latencyMs: attempt.response?.latencyMs ?? 0,
        fromCache: false,
      };
    }

    const confidence = computeMessageExtractionConfidence(attempt.fields, message.rawText);
    const status = classifyMessageExtractionStatus(confidence.score, attempt.fields);

    return {
      ...shared,
      extractedFields: attempt.fields,
      deterministicConfidence: confidence.score,
      aiSelfReportedConfidence: attempt.aiSelfReportedConfidence,
      missingFields: confidence.missingFields,
      status,
      tokenUsage: attempt.response.usage,
      estimatedCostUsd: estimateCost(attempt.response.usage, getModelPricing(attempt.response.provider, attempt.response.model)),
      latencyMs: attempt.response.latencyMs,
      fromCache: attempt.fromCache,
    };
  }

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

  private recordMetrics(response: AIResponse | undefined, extraction: MessageExtraction, request: AIRequest): void {
    this.deps.metrics.incrementCounter(AI_METRICS.REQUEST_COMPLETED);
    this.deps.metrics.recordHistogram(AI_METRICS.CONFIDENCE_DISTRIBUTION, extraction.deterministicConfidence / 100);
    this.deps.metrics.recordHistogram(AI_METRICS.COST_USD, extraction.estimatedCostUsd);
    this.deps.metrics.recordHistogram(AI_METRICS.TOKENS_TOTAL, extraction.tokenUsage.totalTokens);
    this.deps.metrics.recordHistogram(AI_METRICS.TOKENS_PROMPT, extraction.tokenUsage.promptTokens);
    this.deps.metrics.recordHistogram(AI_METRICS.TOKENS_COMPLETION, extraction.tokenUsage.completionTokens);

    if (response) {
      this.deps.metrics.incrementCounter(AI_METRICS.PROVIDER_SUCCESS, 1, { provider: response.provider });
      this.deps.metrics.incrementCounter(AI_METRICS.MODEL_REQUEST, 1, { model: response.model, provider: response.provider });
      this.deps.metrics.recordHistogram(AI_METRICS.REQUEST_DURATION, response.latencyMs);
    }

    this.deps.costTracker.record({
      requestId: response?.requestId ?? extraction.id,
      provider: extraction.provider,
      model: extraction.model,
      usage: extraction.tokenUsage,
      estimatedCostUsd: extraction.estimatedCostUsd,
      latencyMs: extraction.latencyMs,
      promptId: request.promptId,
      promptVersion: request.promptVersion,
    });
  }
}

function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced?.[1] ?? content;
}

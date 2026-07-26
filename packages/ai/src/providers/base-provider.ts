import type { AIProvider, AIProviderConfig } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities } from '../domain/ai-types.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';

/**
 * Strips potential API key fragments from error response bodies before they
 * propagate into logs or thrown errors. Matches common key prefixes used by
 * the providers we support (sk-, gsk_, sk-ant-, etc.) and masks everything
 * on the same line that looks like a key value.
 */
export function sanitizeErrorBody(body: string): string {
  return body
    .replace(/["']?(?:key|api[_-]?key|token|secret|authorization)["']?\s*[:=]\s*["']?[A-Za-z0-9_./-]{20,}["']?/gi, '[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9]{20,})\b/g, '[REDACTED]')
    .replace(/\b(gsk_[A-Za-z0-9]{20,})\b/g, '[REDACTED]')
    .replace(/\b(sk-ant-[A-Za-z0-9_-]{20,})\b/g, '[REDACTED]');
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;

  protected readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const result = await this.doComplete(request);
      const latencyMs = Date.now() - startTime;

      return {
        ...result,
        latencyMs,
        provider: this.name,
      };
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      throw new AIError({
        type: this.classifyError(error),
        message: error instanceof Error ? error.message : String(error),
        provider: this.name,
        model: request.model ?? this.defaultModel,
        retryable: this.isRetryableError(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  abstract getCapabilities(): AICapabilities;

  validateConfig(): boolean {
    return Boolean(this.config.apiKey);
  }

  protected abstract doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>>;

  protected classifyError(error: unknown): AIErrorType {
    if (error instanceof AIError) return error.type;

    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    // Checked before the quota branch: Groq (and other providers) report
    // request-too-large / TPM rate limiting as HTTP 413 with a
    // `rate_limit_exceeded` code, e.g. "Request too large for model ...
    // tokens per minute (TPM): Limit 6000, Requested 6231 ... code:
    // rate_limit_exceeded". That message also contains the word "exceeded",
    // which used to fall through to the generic quota check below and get
    // misclassified as QUOTA_EXCEEDED (non-retryable) instead of a
    // retryable rate limit.
    if (
      lower.includes('rate limit') ||
      lower.includes('rate_limit_exceeded') ||
      lower.includes('tokens per minute') ||
      lower.includes('request too large') ||
      lower.includes('429') ||
      lower.includes('413')
    ) {
      return AIErrorType.RATE_LIMITED;
    }
    if (lower.includes('timeout') || lower.includes('timed out')) {
      return AIErrorType.TIMEOUT;
    }
    if (lower.includes('auth') || lower.includes('401') || lower.includes('403')) {
      return AIErrorType.AUTHENTICATION_ERROR;
    }
    if (lower.includes('quota') || lower.includes('insufficient_quota') || lower.includes('billing')) {
      return AIErrorType.QUOTA_EXCEEDED;
    }
    if (lower.includes('network') || lower.includes('econnrefused')) {
      return AIErrorType.NETWORK_ERROR;
    }

    return AIErrorType.PROVIDER_ERROR;
  }

  protected isRetryableError(error: unknown): boolean {
    const type = this.classifyError(error);
    return type === AIErrorType.RATE_LIMITED
      || type === AIErrorType.TIMEOUT
      || type === AIErrorType.NETWORK_ERROR;
  }
}

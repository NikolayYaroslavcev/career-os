import { AIError } from '../domain/ai-error.js';

export interface AIRetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly jitter: boolean;
}

export const DEFAULT_AI_RETRY_CONFIG: AIRetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Retries an AIProvider call on retryable AIErrors (rate limits, timeouts,
 * network errors — see AIError.retryable) with exponential backoff. Mirrors
 * packages/providers' RetryPolicy, but operates on AIError/throw semantics
 * instead of that package's Result-returning ProviderError.
 */
export class AIRetryPolicy {
  constructor(private readonly config: AIRetryConfig = DEFAULT_AI_RETRY_CONFIG) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        const retryable = error instanceof AIError && error.retryable;
        if (!retryable || attempt === this.config.maxAttempts) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, error instanceof AIError ? error : undefined);
        await this.sleep(delay);
      }
    }

    // Unreachable — the loop always returns or throws — but keeps TS happy.
    throw lastError;
  }

  private calculateDelay(attempt: number, error?: AIError): number {
    if (error?.retryAfterMs !== undefined && error.retryAfterMs > 0 && error.retryAfterMs < this.config.maxDelayMs) {
      return error.retryAfterMs;
    }

    let delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.config.maxDelayMs);

    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import type { ProviderResult, ProviderError } from '../interfaces/result.js';
import { ProviderErrorType } from '../errors/provider-errors.js';

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly jitter: boolean;
  readonly retryableErrors: ReadonlySet<ProviderErrorType>;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: new Set([
    ProviderErrorType.NETWORK_ERROR,
    ProviderErrorType.RATE_LIMITED,
    ProviderErrorType.PROVIDER_UNAVAILABLE,
  ]),
};

export class RetryPolicy {
  constructor(private readonly config: RetryConfig) {}

  async execute<T>(
    operation: () => Promise<ProviderResult<T>>,
    _context: { providerId: string; operation: string },
  ): Promise<ProviderResult<T>> {
    let lastError: ProviderError | null = null;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const result = await operation();

      if (result.ok) return result;

      lastError = result;

      if (!this.config.retryableErrors.has(result.error)) {
        return result;
      }

      if (attempt === this.config.maxAttempts) break;

      const delay = this.calculateDelay(attempt, result);
      await this.sleep(delay);
    }

    return lastError!;
  }

  private calculateDelay(attempt: number, error: ProviderError): number {
    if (error.error === ProviderErrorType.RATE_LIMITED && error.meta?.rateLimit?.resetAt) {
      const retryAfter = error.meta.rateLimit.resetAt.getTime() - Date.now();
      if (retryAfter > 0 && retryAfter < this.config.maxDelayMs) {
        return retryAfter;
      }
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

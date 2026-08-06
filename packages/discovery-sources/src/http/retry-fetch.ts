/**
 * ADR-035 §6: bulk source fetch retry — "3 attempts, exponential backoff,
 * same RetryPolicy config shape already used by Social Message transports."
 * packages/providers' RetryPolicy itself is coupled to ProviderResult/
 * ProviderError (packages/providers/src/interfaces/result.ts) — reusing it
 * as-is here would force every bulk source to speak that provider-specific
 * result shape for no benefit. This reuses the exact same numbers
 * (DEFAULT_RETRY_CONFIG: 3 attempts, 1s base, 30s max, 2x multiplier,
 * jitter) against a plain fetch() call instead.
 */
export interface RetryFetchConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly jitter: boolean;
}

export const DEFAULT_BULK_FETCH_RETRY_CONFIG: RetryFetchConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitter: true,
};

function delayForAttempt(attempt: number, config: RetryFetchConfig): number {
  let delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  delay = Math.min(delay, config.maxDelayMs);
  if (config.jitter) delay *= 0.5 + Math.random() * 0.5;
  return Math.floor(delay);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries transient failures (network error, 429, 5xx) — a 4xx (other than 429) is not retried, same "retryable vs. not" split RetryPolicy already draws. */
export async function retryFetch(
  url: string,
  init: RequestInit,
  config: RetryFetchConfig = DEFAULT_BULK_FETCH_RETRY_CONFIG
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      if (response.status !== 429 && response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status} fetching ${url}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < config.maxAttempts) {
      await sleep(delayForAttempt(attempt, config));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

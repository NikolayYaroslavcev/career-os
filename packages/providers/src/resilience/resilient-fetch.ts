export interface ResilientFetchConfig {
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly rateLimitMs?: number;
}

const DEFAULT_CONFIG: Required<ResilientFetchConfig> = {
  timeoutMs: 15_000,
  maxRetries: 3,
  retryDelayMs: 1_000,
  rateLimitMs: 200,
};

const lastCallTimes = new Map<string, number>();

/** A 4xx (other than 429) is a permanent failure — thrown to break out of the retry loop immediately instead of consuming the retry budget. */
class NonRetryableFetchError extends Error {}

async function waitForRateLimit(key: string, rateLimitMs: number): Promise<void> {
  const now = Date.now();
  const lastCall = lastCallTimes.get(key) ?? 0;
  const elapsed = now - lastCall;
  if (elapsed < rateLimitMs) {
    await new Promise((resolve) => setTimeout(resolve, rateLimitMs - elapsed));
  }
  lastCallTimes.set(key, Date.now());
}

/**
 * A single fetch with a real timeout: races a plain setTimeout would leave the
 * underlying fetch (and its socket) running in the background after "timing
 * out" — an AbortController is required to actually cancel the in-flight
 * request. Exported for fetchers whose response-status handling (custom
 * 403/404/429 branching per provider) can't go through resilientFetch's own
 * retry/throw semantics without changing that behavior — this only adds the
 * missing timeout, nothing else.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_CONFIG.timeoutMs,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function resilientFetch(
  url: string | URL,
  providerId: string,
  config: ResilientFetchConfig = {},
  init?: RequestInit,
): Promise<Response> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    await waitForRateLimit(providerId, cfg.rateLimitMs);

    try {
      const response = await fetchWithTimeout(url, init, cfg.timeoutMs);
      if (response.ok) return response;

      // Don't retry on 4xx (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new NonRetryableFetchError(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 429 rate limit — wait longer
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : cfg.retryDelayMs * 2;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (error instanceof NonRetryableFetchError) {
        throw lastError;
      }
    }

    if (attempt < cfg.maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, cfg.retryDelayMs * (attempt + 1)));
    }
  }

  throw lastError ?? new Error('Fetch failed after retries');
}

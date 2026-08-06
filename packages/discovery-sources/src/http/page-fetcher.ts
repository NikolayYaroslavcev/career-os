import { TokenBucketRateLimiter } from '@careeros/providers';
import { retryFetch } from './retry-fetch.js';

/**
 * ADR-035 §14: "reuse the existing TokenBucket rate limiter... per
 * target-domain... so a large batch doesn't open thousands of sockets."
 * Shared by every CC-Index-seeded source (sitemap/robots/JSON-LD/RSS) since
 * they all fetch the *matched page itself*, not just query the index.
 */
const PER_HOST_RATE_LIMIT = { capacity: 5, refillRate: 5, refillIntervalMs: 1000 };

const limiter = new TokenBucketRateLimiter(PER_HOST_RATE_LIMIT);

async function waitForToken(hostname: string): Promise<void> {
  const maxWaitMs = 5000;
  const pollMs = 100;
  let waited = 0;
  while (!(await limiter.acquire(hostname))) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    waited += pollMs;
    if (waited >= maxWaitMs) return; // proceed anyway rather than stalling the batch indefinitely
  }
}

/** Rate-limited fetch of a matched-page's content, keyed by hostname so one slow/high-volume host can't starve the rest of a batch. Returns null on any failure — a single bad page must never abort the batch (ADR §13). */
export async function fetchPageContent(url: string, userAgent: string): Promise<string | null> {
  try {
    const hostname = new URL(url).hostname;
    await waitForToken(hostname);
    const response = await retryFetch(url, { headers: { 'User-Agent': userAgent } }, { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

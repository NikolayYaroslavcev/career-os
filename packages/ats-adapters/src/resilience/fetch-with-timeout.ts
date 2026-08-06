const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Local copy of `packages/providers/src/resilience/resilient-fetch.ts`'s
 * `fetchWithTimeout`. `ats-adapters` cannot depend on `providers` (that would
 * create `providers -> ats-adapters -> providers`, a cycle) — see ADR-033
 * risk #2. Kept as a single small pure function rather than a new shared
 * package for ~15 lines of code.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resilientFetch } from '../resilient-fetch.js';

function jsonResponse(init: { ok: boolean; status: number }): Response {
  return {
    ok: init.ok,
    status: init.status,
    statusText: 'Status',
    headers: new Headers(),
  } as Response;
}

describe('resilientFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the response immediately on success without retrying', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true, status: 200 }));

    const response = await resilientFetch('https://example.com', 'test-provider');

    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails fast on a non-429 4xx response instead of consuming the retry budget', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: false, status: 404 }));

    await expect(resilientFetch('https://example.com', 'test-provider-404')).rejects.toThrow('HTTP 404');
    // A single attempt only — a 404 is a permanent failure, not a transient one.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails fast on a 400 Bad Request without retrying', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: false, status: 400 }));

    await expect(resilientFetch('https://example.com', 'test-provider-400')).rejects.toThrow('HTTP 400');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx response up to maxRetries before giving up', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, status: 503 }));

    await expect(
      resilientFetch('https://example.com', 'test-provider-503', { maxRetries: 1, retryDelayMs: 1 })
    ).rejects.toThrow('HTTP 503');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('waits and retries on a 429 rate-limit response, then succeeds', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ ok: false, status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200 }));

    const response = await resilientFetch('https://example.com', 'test-provider-429', {
      retryDelayMs: 1,
      rateLimitMs: 0,
    });

    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('actually aborts the underlying fetch on timeout (passes a real AbortSignal), not just a timer race', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_url, init) => {
      const signal = (init as RequestInit)?.signal ?? undefined;
      capturedSignal = signal;
      // Mimics real fetch: only settles when the request completes OR the
      // signal aborts — proving resilientFetch's timeout actually propagates
      // an abort into the fetch call, not just a timer race around a promise
      // that keeps running in the background.
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const resultPromise = resilientFetch('https://example.com', 'test-provider-timeout', {
      timeoutMs: 5,
      maxRetries: 0,
    });

    await expect(resultPromise).rejects.toThrow('Timeout after 5ms');
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('forwards custom RequestInit (headers) through to fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true, status: 200 }));

    await resilientFetch('https://example.com', 'test-provider-headers', {}, {
      headers: { Authorization: 'Bearer token123' },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ headers: { Authorization: 'Bearer token123' } })
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryPolicy, DEFAULT_RETRY_CONFIG } from '../retry/retry-policy.js';
import { ProviderErrorType } from '../errors/provider-errors.js';
import type { ProviderResult } from '../interfaces/result.js';

describe('RetryPolicy', () => {
  let policy: RetryPolicy;

  beforeEach(() => {
    policy = new RetryPolicy(DEFAULT_RETRY_CONFIG);
  });

  it('should return success on first attempt', async () => {
    const operation = vi.fn<() => Promise<ProviderResult<string>>>().mockResolvedValue({
      ok: true,
      data: 'success',
      meta: { durationMs: 100 },
    });

    const result = await policy.execute(operation, { providerId: 'test', operation: 'test' });

    expect(result.ok).toBe(true);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    vi.useFakeTimers();
    const operation = vi.fn<() => Promise<ProviderResult<string>>>()
      .mockResolvedValueOnce({
        ok: false,
        error: ProviderErrorType.NETWORK_ERROR,
        message: 'Network error',
        retryable: true,
        meta: { durationMs: 100 },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: 'success',
        meta: { durationMs: 100 },
      });

    const resultPromise = policy.execute(operation, { providerId: 'test', operation: 'test' });
    await vi.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;
    expect(result.ok).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should not retry on non-retryable errors', async () => {
    const operation = vi.fn<() => Promise<ProviderResult<string>>>().mockResolvedValue({
      ok: false,
      error: ProviderErrorType.AUTHENTICATION_ERROR,
      message: 'Auth failed',
      retryable: false,
      meta: { durationMs: 100 },
    });

    const result = await policy.execute(operation, { providerId: 'test', operation: 'test' });

    expect(result.ok).toBe(false);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should exhaust max attempts', async () => {
    vi.useFakeTimers();
    const operation = vi.fn<() => Promise<ProviderResult<string>>>().mockResolvedValue({
      ok: false,
      error: ProviderErrorType.NETWORK_ERROR,
      message: 'Network error',
      retryable: true,
      meta: { durationMs: 100 },
    });

    const resultPromise = policy.execute(operation, { providerId: 'test', operation: 'test' });
    await vi.advanceTimersByTimeAsync(10000);

    const result = await resultPromise;
    expect(result.ok).toBe(false);
    expect(operation).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });
});

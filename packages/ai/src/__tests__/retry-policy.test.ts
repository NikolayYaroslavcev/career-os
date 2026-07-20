import { describe, it, expect, vi } from 'vitest';
import { AIRetryPolicy, DEFAULT_AI_RETRY_CONFIG } from '../resilience/retry-policy.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';

describe('AIRetryPolicy', () => {
  it('returns the result on first success without retrying', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    const policy = new AIRetryPolicy(DEFAULT_AI_RETRY_CONFIG);

    const result = await policy.execute(operation);

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on a retryable AIError and eventually succeeds', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new AIError({ type: AIErrorType.RATE_LIMITED, message: 'rate limited', provider: 'test', retryable: true })
      )
      .mockResolvedValueOnce('ok');
    const policy = new AIRetryPolicy(DEFAULT_AI_RETRY_CONFIG);

    const resultPromise = policy.execute(operation);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(resultPromise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not retry a non-retryable AIError', async () => {
    const error = new AIError({
      type: AIErrorType.AUTHENTICATION_ERROR,
      message: 'bad key',
      provider: 'test',
      retryable: false,
    });
    const operation = vi.fn().mockRejectedValue(error);
    const policy = new AIRetryPolicy(DEFAULT_AI_RETRY_CONFIG);

    await expect(policy.execute(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry a plain non-AIError', async () => {
    const error = new Error('boom');
    const operation = vi.fn().mockRejectedValue(error);
    const policy = new AIRetryPolicy(DEFAULT_AI_RETRY_CONFIG);

    await expect(policy.execute(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts and throws the last error', async () => {
    vi.useFakeTimers();
    const error = new AIError({ type: AIErrorType.TIMEOUT, message: 'timeout', provider: 'test', retryable: true });
    const operation = vi.fn().mockRejectedValue(error);
    const policy = new AIRetryPolicy({ ...DEFAULT_AI_RETRY_CONFIG, maxAttempts: 3 });

    const resultPromise = policy.execute(operation);
    resultPromise.catch(() => {});
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(resultPromise).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('honors AIError.retryAfterMs as the delay when it is smaller than maxDelayMs', async () => {
    vi.useFakeTimers();
    const error = new AIError({
      type: AIErrorType.RATE_LIMITED,
      message: 'rate limited',
      provider: 'test',
      retryable: true,
      retryAfterMs: 500,
    });
    const operation = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');
    const policy = new AIRetryPolicy(DEFAULT_AI_RETRY_CONFIG);

    const resultPromise = policy.execute(operation);
    // Would still be pending if the default 1s backoff were used instead of the 500ms hint.
    await vi.advanceTimersByTimeAsync(500);

    await expect(resultPromise).resolves.toBe('ok');
    vi.useRealTimers();
  });
});

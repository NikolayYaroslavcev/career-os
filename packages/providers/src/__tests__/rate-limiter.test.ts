import { describe, it, expect } from 'vitest';
import { TokenBucketRateLimiter } from '../rate-limit/rate-limiter.js';

describe('TokenBucketRateLimiter', () => {
  it('should allow acquiring tokens within capacity', async () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 10,
      refillRate: 1,
      refillIntervalMs: 1000,
    });

    const result = await limiter.acquire('test-key');
    expect(result).toBe(true);
  });

  it('should reject tokens when capacity exceeded', async () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillRate: 1,
      refillIntervalMs: 1000,
    });

    expect(await limiter.acquire('test-key')).toBe(true);
    expect(await limiter.acquire('test-key')).toBe(true);
    expect(await limiter.acquire('test-key')).toBe(false);
  });

  it('should return correct status', async () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillRate: 1,
      refillIntervalMs: 1000,
    });

    const status = limiter.getStatus('test-key');
    expect(status.available).toBe(5);
    expect(status.capacity).toBe(5);
    expect(status.refillsAt).toBeInstanceOf(Date);
  });

  it('should reset bucket', async () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillRate: 1,
      refillIntervalMs: 1000,
    });

    await limiter.acquire('test-key');
    expect(await limiter.acquire('test-key')).toBe(false);

    limiter.reset('test-key');
    expect(await limiter.acquire('test-key')).toBe(true);
  });
});

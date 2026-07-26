import type { Redis } from 'ioredis';

/**
 * Distributed per-key rate limiter backed by Redis `SET key val PX ms NX` —
 * atomic across backend replicas, unlike a per-process in-memory Map (which
 * lets each replica independently allow one request per window, silently
 * multiplying the effective limit by replica count).
 */
export class RedisRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix: string,
    private readonly windowMs: number
  ) {}

  /** Returns true if this call is allowed (and records it); false if the caller is still within the window. */
  async checkAndRecord(id: string): Promise<boolean> {
    const key = `${this.keyPrefix}:${id}`;
    const result = await this.redis.set(key, '1', 'PX', this.windowMs, 'NX');
    return result === 'OK';
  }
}

import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });
}

export function getRedis(url?: string): Redis {
  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';
  globalForRedis.redis = createRedisClient(redisUrl);
  return globalForRedis.redis;
}

export async function disconnectRedis(): Promise<void> {
  if (globalForRedis.redis) {
    await globalForRedis.redis.quit();
    globalForRedis.redis = undefined;
    console.log('Redis disconnected successfully');
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Distributed per-key rate limiter / single-use claim backed by Redis
 * `SET key val PX ms NX` — atomic across replicas, unlike a per-process
 * in-memory Map (which lets each replica independently allow one call per
 * window, silently multiplying the effective limit by replica count).
 *
 * Doubles as a claim lock: `checkAndRecord(id)` returns true only for the
 * first caller within the window, so it also works to make sure a task
 * (e.g. a scheduled sweep that could run from more than one process) is only
 * acted on once per window.
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

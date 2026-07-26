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

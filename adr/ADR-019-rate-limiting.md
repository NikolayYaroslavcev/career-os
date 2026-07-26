# ADR-019: Rate Limiting Strategy

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS needs rate limiting for:

- API protection
- Abuse prevention
- Fair usage across tenants
- Cost control (AI calls)

We need:

- Workspace-scoped limits
- Per-endpoint configuration
- Future SaaS readiness
- Redis-based distributed limiting

## Decision

### Workspace-Scoped Limits

- Limits belong to Workspace
- Each workspace has configurable limits
- MVP: single workspace per user
- Future: per-workspace billing limits

## Consequences

### Positive

- Fair usage across tenants
- Easy to add SaaS billing tiers
- Prevents abuse
- Controls AI API costs

### Negative

- More complex than global limits
- Requires workspace context in middleware
- Redis dependency for distributed limiting

### Mitigations

- Default limits for all workspaces
- Simple configuration
- Redis already in stack

## Architecture

```
Request
    ↓
Fastify Middleware
    ↓
Extract workspaceId from JWT
    ↓
Check rate limit in Redis
    ↓
Allow or reject (429)
```

## Rate Limit Structure

```typescript
interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Max requests per window
  keyGenerator?: (request: FastifyRequest) => string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  total: number;
}
```

## Default Limits

| Endpoint | Window | Limit | Scope |
|----------|--------|-------|-------|
| /api/v1/auth/* | 15 min | 10 | IP |
| /api/v1/jobs/* | 1 min | 60 | Workspace |
| /api/v1/applications/* | 1 min | 100 | Workspace |
| /api/v1/ai/* | 1 min | 20 | Workspace |
| /api/v1/upload | 1 min | 10 | Workspace |

## Implementation

### Redis-Based Limiter

```typescript
// packages/shared/src/infrastructure/RedisRateLimiter.ts
import Redis from 'ioredis';

export class RedisRateLimiter {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    const count = await this.redis.zcard(key);
    
    // Add current request
    await this.redis.zadd(key, now.toString(), `${now}-${Math.random()}`);
    await this.redis.expire(key, Math.ceil(config.windowMs / 1000));
    
    return {
      allowed: count < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count - 1),
      resetAt: new Date(now + config.windowMs),
      total: config.maxRequests,
    };
  }
}
```

### Fastify Plugin

```typescript
// packages/shared/src/infrastructure/rateLimitPlugin.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function rateLimitPlugin(fastify: FastifyInstance) {
  const limiter = new RedisRateLimiter(fastify.redis);
  
  fastify.decorate('checkRateLimit', async (
    request: FastifyRequest,
    reply: FastifyReply,
    config: RateLimitConfig
  ) => {
    const workspaceId = request.user?.workspaceId || 'global';
    const keyGenerator = config.keyGenerator || (() => 
      `${workspaceId}:${request.url}:${request.ip}`
    );
    const key = keyGenerator(request);
    
    const result = await limiter.check(key, config);
    
    reply.header('X-RateLimit-Limit', result.total);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', result.resetAt.toISOString());
    
    if (!result.allowed) {
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again after ${result.resetAt.toISOString()}`,
        retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
      });
    }
  });
}
```

### Usage in Routes

```typescript
// Usage in route
fastify.get('/jobs', {
  preHandler: [
    async (request, reply) => {
      await fastify.checkRateLimit(request, reply, {
        windowMs: 60 * 1000,  // 1 minute
        maxRequests: 60,
      });
    }
  ]
}, async (request, reply) => {
  // Handle request
});
```

## Workspace Configuration

### Default Limits

```typescript
// packages/shared/src/domain/workspace.ts
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  api: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100,
  },
  ai: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 20,
  },
  upload: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
  },
};
```

### Custom Limits per Workspace

```typescript
// Future: workspace-specific limits
interface Workspace {
  id: string;
  name: string;
  rateLimits?: {
    api?: Partial<RateLimitConfig>;
    ai?: Partial<RateLimitConfig>;
  };
  plan: 'free' | 'pro' | 'enterprise';
}
```

## SaaS Readiness

### Plan-Based Limits

| Plan | API Limit | AI Limit | Upload Limit |
|------|-----------|----------|--------------|
| Free | 100/min | 20/min | 10/min |
| Pro | 500/min | 100/min | 50/min |
| Enterprise | Custom | Custom | Custom |

### Implementation

```typescript
function getLimitsForPlan(plan: string): Record<string, RateLimitConfig> {
  switch (plan) {
    case 'enterprise':
      return { /* custom limits */ };
    case 'pro':
      return { /* pro limits */ };
    default:
      return DEFAULT_RATE_LIMITS;
  }
}
```

## Error Response

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again after 2025-01-15T12:00:00.000Z",
  "retryAfter": 30
}
```

## Headers

| Header | Description |
|--------|-------------|
| X-RateLimit-Limit | Max requests per window |
| X-RateLimit-Remaining | Remaining requests |
| X-RateLimit-Reset | Window reset time (ISO) |
| Retry-After | Seconds until retry (on 429) |

## Configuration

```bash
# .env
REDIS_URL=redis://localhost:6379
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT_WINDOW=60000
RATE_LIMIT_DEFAULT_MAX=100
```

## References

- [Redis Rate Limiting](https://redis.io/commands/#sorted-set)
- [HTTP Rate Limit Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-RateLimit-Limit)
- [Sliding Window Rate Limiting](https://redis.io/commands/XRANGEBYSCORE)

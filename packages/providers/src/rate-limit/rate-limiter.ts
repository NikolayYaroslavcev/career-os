export interface RateLimitConfig {
  readonly capacity: number;
  readonly refillRate: number;
  readonly refillIntervalMs: number;
}

export interface BucketStatus {
  readonly available: number;
  readonly capacity: number;
  readonly refillsAt: Date;
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly config: RateLimitConfig) {
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
  }

  consume(tokens: number): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  getStatus(): BucketStatus {
    this.refill();
    return {
      available: Math.floor(this.tokens),
      capacity: this.config.capacity,
      refillsAt: new Date(this.lastRefill + this.config.refillIntervalMs),
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.config.refillIntervalMs) * this.config.refillRate;
    this.tokens = Math.min(this.config.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, TokenBucket>();

  constructor(private readonly config: RateLimitConfig) {}

  async acquire(key: string, tokens: number = 1): Promise<boolean> {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.config);
      this.buckets.set(key, bucket);
    }
    return bucket.consume(tokens);
  }

  getStatus(key: string): BucketStatus {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return {
        available: this.config.capacity,
        capacity: this.config.capacity,
        refillsAt: new Date(),
      };
    }
    return bucket.getStatus();
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

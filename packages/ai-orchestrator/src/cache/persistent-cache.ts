import type { AICacheRepository } from '@careeros/database';
import type { CacheEntry } from '../orchestrator-config.js';
import { buildCacheKey, type CacheKeyInput } from './cache-key.js';

export interface PersistentCacheConfig {
  readonly defaultTtlMs?: number;
}

export class PersistentCache {
  private readonly repository: AICacheRepository;
  private readonly defaultTtlMs: number;

  constructor(repository: AICacheRepository, config?: PersistentCacheConfig) {
    this.repository = repository;
    this.defaultTtlMs = config?.defaultTtlMs ?? 24 * 60 * 60 * 1000; // 24h
  }

  async get<T = unknown>(input: CacheKeyInput): Promise<CacheEntry<T> | null> {
    const cacheKey = buildCacheKey(input);
    const record = await this.repository.findByKey(cacheKey);

    if (!record) return null;

    if (record.expiresAt < new Date()) {
      await this.repository.deleteExpired();
      return null;
    }

    // Increment hit count
    await this.repository.incrementHitCount(record.id);

    return {
      response: record.response as T,
      provider: record.provider,
      model: record.model,
      promptVersion: record.promptVersion,
      tokensIn: record.tokensIn,
      tokensOut: record.tokensOut,
      estimatedCost: record.estimatedCost,
    };
  }

  async set<T = unknown>(
    input: CacheKeyInput,
    response: T,
    usage: { tokensIn: number; tokensOut: number; estimatedCost: number },
    ttlMs?: number
  ): Promise<void> {
    const cacheKey = buildCacheKey(input);

    await this.repository.create({
      cacheKey,
      provider: input.provider,
      model: input.model,
      promptVersion: input.promptVersion,
      feature: input.feature,
      response,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      estimatedCost: usage.estimatedCost,
      ttlMs: ttlMs ?? this.defaultTtlMs,
    });
  }

  async invalidate(feature?: string): Promise<number> {
    if (feature) {
      return this.repository.deleteByFeature(feature);
    }
    return this.repository.deleteAll();
  }

  async getStats(): Promise<{ totalEntries: number; totalHits: number; totalSavedTokens: number }> {
    return this.repository.getStats();
  }

  async cleanup(): Promise<number> {
    return this.repository.deleteExpired();
  }
}

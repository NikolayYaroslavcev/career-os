import type { AICache, AICacheEntry, AIResponse } from '@careeros/ai';
import type { AICacheRepository } from './prisma-ai-cache-repository.js';

/**
 * Adapts the persisted `AICache` Prisma table (already built for
 * AIOrchestrator's PersistentCache) to the plain `AICache` interface
 * `MatchingEngine`/`MessageExtractionEngine`/the tailoring pipeline expect —
 * so call sites that need a cache that survives process restarts and is
 * shared across worker instances (unlike `InMemoryAICache`) don't need a
 * second cache table or a second caching abstraction, only this adapter.
 * `feature` scopes `clear()`/accounting to this cache instance's own rows —
 * the underlying table is shared with AIOrchestrator's PersistentCache and
 * any other `PrismaAICache` instance, so an unscoped clear would be a
 * cross-feature footgun.
 */
export class PrismaAICache implements AICache {
  constructor(
    private readonly repository: AICacheRepository,
    private readonly feature: string,
    /** Recorded on each row for observability only — the cache key itself already encodes the prompt version via computePromptHash(), so a stale value here just misses naturally rather than serving wrong data. */
    private readonly promptVersion: string = 'unknown',
  ) {}

  async get(promptHash: string): Promise<AICacheEntry | null> {
    const record = await this.repository.findByKey(promptHash);
    if (!record) return null;

    await this.repository.incrementHitCount(record.id);

    return {
      response: record.response as AIResponse,
      cachedAt: record.createdAt,
      ttlMs: record.expiresAt.getTime() - record.createdAt.getTime(),
    };
  }

  async set(promptHash: string, response: AIResponse, ttlMs?: number): Promise<void> {
    await this.repository.create({
      cacheKey: promptHash,
      provider: response.provider,
      model: response.model,
      promptVersion: this.promptVersion,
      feature: this.feature,
      response,
      tokensIn: response.usage.promptTokens,
      tokensOut: response.usage.completionTokens,
      ttlMs,
    });
  }

  async has(promptHash: string): Promise<boolean> {
    return (await this.get(promptHash)) !== null;
  }

  async delete(promptHash: string): Promise<void> {
    await this.repository.deleteByKey(promptHash);
  }

  async clear(): Promise<void> {
    await this.repository.deleteByFeature(this.feature);
  }
}

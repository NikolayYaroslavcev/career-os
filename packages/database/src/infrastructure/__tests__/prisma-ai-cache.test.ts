import { describe, it, expect, beforeEach } from 'vitest';
import type { AIResponse } from '@careeros/ai';
import { PrismaAICache } from '../prisma-ai-cache.js';
import type { AICacheRepository } from '../prisma-ai-cache-repository.js';
import type { AICacheData, CreateAICacheInput } from '../../mappers/ai-cache-mapper.js';

class FakeAICacheRepository implements AICacheRepository {
  private readonly rows = new Map<string, AICacheData>();
  hitCounts = new Map<string, number>();

  async create(input: CreateAICacheInput): Promise<AICacheData> {
    const now = new Date();
    const record: AICacheData = {
      id: input.cacheKey,
      cacheKey: input.cacheKey,
      provider: input.provider,
      model: input.model,
      promptVersion: input.promptVersion,
      feature: input.feature,
      response: input.response,
      tokensIn: input.tokensIn ?? 0,
      tokensOut: input.tokensOut ?? 0,
      estimatedCost: input.estimatedCost ?? 0,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: new Date(now.getTime() + (input.ttlMs ?? 24 * 60 * 60 * 1000)),
    };
    this.rows.set(input.cacheKey, record);
    return record;
  }

  async findByKey(cacheKey: string): Promise<AICacheData | null> {
    return this.rows.get(cacheKey) ?? null;
  }

  async incrementHitCount(id: string): Promise<void> {
    this.hitCounts.set(id, (this.hitCounts.get(id) ?? 0) + 1);
  }

  async deleteByKey(cacheKey: string): Promise<void> {
    this.rows.delete(cacheKey);
  }

  async deleteExpired(): Promise<number> {
    return 0;
  }

  async deleteByFeature(feature: string): Promise<number> {
    let count = 0;
    for (const [key, row] of this.rows) {
      if (row.feature === feature) {
        this.rows.delete(key);
        count++;
      }
    }
    return count;
  }

  async deleteAll(): Promise<number> {
    const count = this.rows.size;
    this.rows.clear();
    return count;
  }

  async getStats(): Promise<{ totalEntries: number; totalHits: number; totalSavedTokens: number }> {
    return { totalEntries: this.rows.size, totalHits: 0, totalSavedTokens: 0 };
  }
}

function fakeResponse(overrides: Partial<AIResponse> = {}): AIResponse {
  return {
    content: '{"ok":true}',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    model: 'fake-model',
    provider: 'fake',
    latencyMs: 5,
    confidence: 1,
    requestId: 'req-1',
    ...overrides,
  };
}

describe('PrismaAICache', () => {
  let repository: FakeAICacheRepository;
  let cache: PrismaAICache;

  beforeEach(() => {
    repository = new FakeAICacheRepository();
    cache = new PrismaAICache(repository, 'tailor_resume.parsing_vacancy', '1.0.0');
  });

  it('returns null on a miss', async () => {
    expect(await cache.get('missing-key')).toBeNull();
  });

  it('round-trips a response through set/get', async () => {
    const response = fakeResponse();
    await cache.set('key-1', response);

    const entry = await cache.get('key-1');
    expect(entry?.response).toEqual(response);
  });

  it('increments the hit count on every get', async () => {
    await cache.set('key-1', fakeResponse());
    await cache.get('key-1');
    await cache.get('key-1');

    const record = await repository.findByKey('key-1');
    expect(repository.hitCounts.get(record!.id)).toBe(2);
  });

  it('has() reflects whether a live entry exists', async () => {
    expect(await cache.has('key-1')).toBe(false);
    await cache.set('key-1', fakeResponse());
    expect(await cache.has('key-1')).toBe(true);
  });

  it('delete() removes only the given key', async () => {
    await cache.set('key-1', fakeResponse());
    await cache.set('key-2', fakeResponse());

    await cache.delete('key-1');

    expect(await cache.get('key-1')).toBeNull();
    expect(await cache.get('key-2')).not.toBeNull();
  });

  it('clear() only removes entries for this cache instance\'s own feature, not other features sharing the table', async () => {
    await cache.set('key-1', fakeResponse());
    const otherFeatureCache = new PrismaAICache(repository, 'analyze_vacancy', '1.0.0');
    await otherFeatureCache.set('key-2', fakeResponse());

    await cache.clear();

    expect(await cache.get('key-1')).toBeNull();
    expect(await otherFeatureCache.get('key-2')).not.toBeNull();
  });
});

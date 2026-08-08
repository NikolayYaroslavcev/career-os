import { describe, it, expect } from 'vitest';
import { InMemoryAICache } from '../ai-cache.js';
import type { AIResponse } from '../../domain/ai-types.js';

function buildResponse(id: string): AIResponse {
  return {
    content: `content-${id}`,
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    model: 'test-model',
    provider: 'test-provider',
    latencyMs: 1,
    confidence: 1,
    requestId: id,
  };
}

describe('InMemoryAICache', () => {
  it('stores and retrieves an entry', async () => {
    const cache = new InMemoryAICache();
    await cache.set('hash-1', buildResponse('1'));

    const entry = await cache.get('hash-1');
    expect(entry?.response.requestId).toBe('1');
  });

  it('evicts the oldest entry once maxEntries is exceeded, instead of growing without bound', async () => {
    const cache = new InMemoryAICache(60_000, 3);

    await cache.set('hash-1', buildResponse('1'));
    await cache.set('hash-2', buildResponse('2'));
    await cache.set('hash-3', buildResponse('3'));
    await cache.set('hash-4', buildResponse('4'));

    expect(cache.size).toBe(3);
    expect(await cache.get('hash-1')).toBeNull();
    expect((await cache.get('hash-4'))?.response.requestId).toBe('4');
  });

  it('treats re-setting an existing key as refreshing it, not adding a second entry', async () => {
    const cache = new InMemoryAICache(60_000, 2);

    await cache.set('hash-1', buildResponse('1'));
    await cache.set('hash-2', buildResponse('2'));
    await cache.set('hash-1', buildResponse('1-updated'));
    await cache.set('hash-3', buildResponse('3'));

    // hash-1 was refreshed most recently, so hash-2 (now the oldest) is the one evicted.
    expect(cache.size).toBe(2);
    expect(await cache.get('hash-2')).toBeNull();
    expect((await cache.get('hash-1'))?.response.requestId).toBe('1-updated');
    expect((await cache.get('hash-3'))?.response.requestId).toBe('3');
  });
});

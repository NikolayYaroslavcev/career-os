import { describe, it, expect, beforeEach } from 'vitest';
import { computePromptHash } from '../cache/prompt-hash.js';
import { InMemoryAICache } from '../cache/ai-cache.js';
import type { AIRequest, AIResponse } from '../domain/ai-types.js';

function createTestRequest(overrides?: Partial<AIRequest>): AIRequest {
  return {
    prompt: 'test prompt',
    promptId: 'test',
    promptVersion: '1.0',
    promptChecksum: 'abc123',
    ...overrides,
  };
}

function createTestResponse(overrides?: Partial<AIResponse>): AIResponse {
  return {
    content: '{"score": 80}',
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    model: 'gpt-4o',
    provider: 'openai',
    latencyMs: 150,
    confidence: 0.85,
    requestId: 'req-1',
    ...overrides,
  };
}

describe('computePromptHash', () => {
  it('produces consistent hash for same input', () => {
    const request = createTestRequest();
    const hash1 = computePromptHash(request);
    const hash2 = computePromptHash(request);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different prompts', () => {
    const hash1 = computePromptHash(createTestRequest({ prompt: 'prompt A' }));
    const hash2 = computePromptHash(createTestRequest({ prompt: 'prompt B' }));
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different models', () => {
    const hash1 = computePromptHash(createTestRequest({ model: 'gpt-4o' }));
    const hash2 = computePromptHash(createTestRequest({ model: 'claude-3' }));
    expect(hash1).not.toBe(hash2);
  });
});

describe('InMemoryAICache', () => {
  let cache: InMemoryAICache;

  beforeEach(() => {
    cache = new InMemoryAICache(60000);
  });

  it('stores and retrieves response', async () => {
    const hash = 'test-hash';
    const response = createTestResponse();

    await cache.set(hash, response);
    const retrieved = await cache.get(hash);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.response.content).toBe(response.content);
  });

  it('returns null for missing key', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('respects TTL expiration', async () => {
    const cache = new InMemoryAICache(1); // 1ms TTL
    const hash = 'test-hash';
    const response = createTestResponse();

    await cache.set(hash, response);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await cache.get(hash);
    expect(result).toBeNull();
  });

  it('checks existence with has()', async () => {
    expect(await cache.has('key')).toBe(false);
    await cache.set('key', createTestResponse());
    expect(await cache.has('key')).toBe(true);
  });

  it('deletes entries', async () => {
    await cache.set('key', createTestResponse());
    expect(await cache.has('key')).toBe(true);

    await cache.delete('key');
    expect(await cache.has('key')).toBe(false);
  });

  it('clears all entries', async () => {
    await cache.set('key1', createTestResponse());
    await cache.set('key2', createTestResponse());
    expect(cache.size).toBe(2);

    await cache.clear();
    expect(cache.size).toBe(0);
  });
});

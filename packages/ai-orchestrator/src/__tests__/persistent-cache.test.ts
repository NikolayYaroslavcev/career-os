import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AICacheRepository } from '@careeros/database';
import { PersistentCache } from '../cache/persistent-cache.js';
import { buildCacheKey } from '../cache/cache-key.js';

const mockRepository = {
  create: vi.fn(),
  findByKey: vi.fn(),
  incrementHitCount: vi.fn(),
  deleteExpired: vi.fn(),
  deleteByFeature: vi.fn(),
  deleteAll: vi.fn(),
  getStats: vi.fn(),
};

describe('PersistentCache', () => {
  let cache: PersistentCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new PersistentCache(mockRepository as unknown as AICacheRepository);
  });

  describe('get', () => {
    it('should return null on cache miss', async () => {
      mockRepository.findByKey.mockResolvedValue(null);

      const result = await cache.get({
        provider: 'openai',
        model: 'gpt-4',
        promptVersion: '1.0.0',
        feature: 'analyze_vacancy',
        contentHash: 'hash123',
      });

      expect(result).toBeNull();
    });

    it('should return cached entry on hit', async () => {
      mockRepository.findByKey.mockResolvedValue({
        id: 'cache-1',
        response: { result: 'cached' },
        provider: 'openai',
        model: 'gpt-4',
        promptVersion: '1.0.0',
        tokensIn: 100,
        tokensOut: 50,
        estimatedCost: 0.01,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await cache.get({
        provider: 'openai',
        model: 'gpt-4',
        promptVersion: '1.0.0',
        feature: 'analyze_vacancy',
        contentHash: 'hash123',
      });

      expect(result).not.toBeNull();
      expect(result?.response).toEqual({ result: 'cached' });
      expect(mockRepository.incrementHitCount).toHaveBeenCalled();
    });

    it('should delete and return null on expired entry', async () => {
      mockRepository.findByKey.mockResolvedValue({
        id: 'cache-1',
        expiresAt: new Date(Date.now() - 86400000),
      });

      const result = await cache.get({
        provider: 'openai',
        model: 'gpt-4',
        promptVersion: '1.0.0',
        feature: 'analyze_vacancy',
        contentHash: 'hash123',
      });

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store a cache entry', async () => {
      await cache.set(
        {
          provider: 'openai',
          model: 'gpt-4',
          promptVersion: '1.0.0',
          feature: 'analyze_vacancy',
          contentHash: 'hash123',
        },
        { result: 'test' },
        { tokensIn: 100, tokensOut: 50, estimatedCost: 0.01 }
      );

      expect(mockRepository.create).toHaveBeenCalled();
      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.provider).toBe('openai');
      expect(createCall.model).toBe('gpt-4');
      expect(createCall.response).toEqual({ result: 'test' });
    });
  });

  describe('invalidate', () => {
    it('should delete cache by feature', async () => {
      mockRepository.deleteByFeature.mockResolvedValue(5);

      const deleted = await cache.invalidate('analyze_vacancy');
      expect(deleted).toBe(5);
      expect(mockRepository.deleteByFeature).toHaveBeenCalledWith('analyze_vacancy');
    });

    it('should delete all cache when no feature specified', async () => {
      mockRepository.deleteAll.mockResolvedValue(10);

      const deleted = await cache.invalidate();
      expect(deleted).toBe(10);
      expect(mockRepository.deleteAll).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockRepository.getStats.mockResolvedValue({
        totalEntries: 100,
        totalHits: 50,
        totalSavedTokens: 5000,
      });

      const stats = await cache.getStats();
      expect(stats.totalEntries).toBe(100);
      expect(stats.totalHits).toBe(50);
      expect(stats.totalSavedTokens).toBe(5000);
    });
  });
});

describe('buildCacheKey', () => {
  it('should generate consistent keys for same input', () => {
    const key1 = buildCacheKey({
      provider: 'openai',
      model: 'gpt-4',
      promptVersion: '1.0.0',
      feature: 'analyze_vacancy',
      contentHash: 'hash123',
    });

    const key2 = buildCacheKey({
      provider: 'openai',
      model: 'gpt-4',
      promptVersion: '1.0.0',
      feature: 'analyze_vacancy',
      contentHash: 'hash123',
    });

    expect(key1).toBe(key2);
  });

  it('should generate different keys for different input', () => {
    const key1 = buildCacheKey({
      provider: 'openai',
      model: 'gpt-4',
      promptVersion: '1.0.0',
      feature: 'analyze_vacancy',
      contentHash: 'hash123',
    });

    const key2 = buildCacheKey({
      provider: 'openai',
      model: 'gpt-4',
      promptVersion: '1.0.0',
      feature: 'analyze_vacancy',
      contentHash: 'hash456',
    });

    expect(key1).not.toBe(key2);
  });

  it('should generate different keys for different prompt versions', () => {
    const key1 = buildCacheKey({
      provider: 'openai',
      model: 'gpt-4',
      promptVersion: '1.0.0',
      feature: 'analyze_vacancy',
      contentHash: 'hash123',
    });

    const key2 = buildCacheKey({
      provider: 'openai',
      model: 'gpt-4',
      promptVersion: '2.0.0',
      feature: 'analyze_vacancy',
      contentHash: 'hash123',
    });

    expect(key1).not.toBe(key2);
  });
});

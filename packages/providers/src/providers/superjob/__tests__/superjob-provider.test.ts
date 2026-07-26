import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSuperJobProvider } from '../superjob-provider.js';
import { SJFetcher } from '../superjob-fetcher.js';
import { SJMapper } from '../superjob-mapper.js';
import { SJNormalizer } from '../superjob-normalizer.js';
import { SJSyncStrategy } from '../superjob-sync-strategy.js';
import type { ProviderState } from '../../../interfaces/provider-state.js';
import { createInitialState } from '../../../interfaces/provider-state.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import searchFixture from '../__fixtures__/superjob-search-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('SuperJobProvider', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('createSuperJobProvider', () => {
    it('should create a provider with correct info', () => {
      const provider = createSuperJobProvider({ apiKey: 'test-key', logger, metrics, tracer });

      expect(provider.info.id).toBe('superjob');
      expect(provider.info.name).toBe('SuperJob');
      expect(provider.info.auth.requiresApiKey).toBe(true);
      expect(provider.info.baseUrl).toBe('https://api.superjob.ru/2.33');
    });

    it('should create a provider with correct capabilities', () => {
      const provider = createSuperJobProvider({ apiKey: 'test-key', logger, metrics, tracer });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('page');
      expect(provider.capabilities.pagination.maxPageSize).toBe(100);
    });

    it('should have all required components', () => {
      const provider = createSuperJobProvider({ apiKey: 'test-key', logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(SJFetcher);
      expect(provider.mapper).toBeInstanceOf(SJMapper);
      expect(provider.normalizer).toBeInstanceOf(SJNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(SJSyncStrategy);
    });
  });

  describe('end-to-end fetch -> map -> normalize', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return real, non-zero, correctly-mapped vacancies for a real API response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const provider = createSuperJobProvider({ apiKey: 'test-key', logger, metrics, tracer });
      const result = await provider.search({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.vacancies.length).toBeGreaterThan(0);
      expect(result.data.normalization.failed).toHaveLength(0);

      const frontend = result.data.vacancies.find((v) => v.sourceId === '45678901');
      expect(frontend?.title).toBe('Frontend-разработчик (React)');
      expect(frontend?.source).toBe('superjob');
    });
  });

  describe('SJSyncStrategy', () => {
    const strategy = new SJSyncStrategy();

    it('should have correct providerId', () => {
      expect(strategy.providerId).toBe('superjob');
    });

    it('should allow sync when state is healthy with no nextSync', () => {
      const state: ProviderState = { ...createInitialState('superjob'), health: 'healthy', nextSync: null };
      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should not sync when state is unhealthy', () => {
      const state: ProviderState = { ...createInitialState('superjob'), health: 'unhealthy', nextSync: null };
      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should not sync when consecutive failures >= 3', () => {
      const state: ProviderState = {
        ...createInitialState('superjob'),
        health: 'healthy',
        consecutiveFailures: 3,
        nextSync: null,
      };
      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should return a page cursor for full sync', () => {
      const cursor = strategy.getFullSyncCursor();
      expect(cursor).toEqual({ type: 'page', page: 0, perPage: 100 });
    });
  });
});

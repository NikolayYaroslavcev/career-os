import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHHProvider } from '../hh-provider.js';
import { HHFetcher } from '../hh-fetcher.js';
import { HHMapper } from '../hh-mapper.js';
import { HHNormalizer } from '../hh-normalizer.js';
import { HHSyncStrategy } from '../hh-sync-strategy.js';
import type { ProviderState } from '../../../interfaces/provider-state.js';
import { createInitialState } from '../../../interfaces/provider-state.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import searchFixture from '../__fixtures__/hh-search-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('HHProvider', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('createHHProvider', () => {
    it('should create a provider with correct info', () => {
      const provider = createHHProvider({ logger, metrics, tracer });

      expect(provider.info.id).toBe('hh');
      expect(provider.info.name).toBe('HeadHunter');
      expect(provider.info.auth.requiresApiKey).toBe(false);
      expect(provider.info.baseUrl).toBe('https://api.hh.ru');
    });

    it('should create a provider with correct capabilities', () => {
      const provider = createHHProvider({ logger, metrics, tracer });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('page');
      expect(provider.capabilities.rateLimits.perMinute).toBe(60);
    });

    it('should have all required components', () => {
      const provider = createHHProvider({ logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(HHFetcher);
      expect(provider.mapper).toBeInstanceOf(HHMapper);
      expect(provider.normalizer).toBeInstanceOf(HHNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(HHSyncStrategy);
    });

    it('should accept an optional access token without requiring one', () => {
      const provider = createHHProvider({ accessToken: 'test-token', logger, metrics, tracer });
      expect(provider.info.auth.optional).toBe(true);
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

      const provider = createHHProvider({ logger, metrics, tracer });
      const result = await provider.search({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.vacancies.length).toBeGreaterThan(0);
      expect(result.data.normalization.failed).toHaveLength(0);

      const frontend = result.data.vacancies.find((v) => v.sourceId === '98765432');
      expect(frontend?.title).toBe('Frontend Developer (React)');
      expect(frontend?.source).toBe('hh');
    });
  });

  describe('HHSyncStrategy', () => {
    const strategy = new HHSyncStrategy();

    it('should have correct providerId', () => {
      expect(strategy.providerId).toBe('hh');
    });

    it('should allow sync when state is healthy with no nextSync', () => {
      const state: ProviderState = { ...createInitialState('hh'), health: 'healthy', nextSync: null };
      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should not sync when state is unhealthy', () => {
      const state: ProviderState = { ...createInitialState('hh'), health: 'unhealthy', nextSync: null };
      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should not sync when consecutive failures >= 3', () => {
      const state: ProviderState = {
        ...createInitialState('hh'),
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

import { describe, it, expect } from 'vitest';
import { createComeetProvider } from '../comeet-provider.js';
import { ComeetFetcher } from '../comeet-fetcher.js';
import { ComeetMapper } from '../comeet-mapper.js';
import { ComeetNormalizer } from '../comeet-normalizer.js';
import { DefaultSyncStrategy } from '../../../interfaces/default-sync-strategy.js';
import type { ProviderState } from '../../../interfaces/provider-state.js';
import { createInitialState } from '../../../interfaces/provider-state.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('ComeetProvider', () => {
  describe('createComeetProvider', () => {
    it('should create a provider with correct info', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createComeetProvider({
        token: 'test-token',
        companyUid: 'test-uid',
        companyName: 'Test Company',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.id).toBe('comeet');
      expect(provider.info.name).toBe('Comeet');
      expect(provider.info.version).toBe('1.0.0');
    });

    it('should have all required components', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createComeetProvider({
        token: 'test-token',
        companyUid: 'test-uid',
        companyName: 'Test Company',
        logger,
        metrics,
        tracer,
      });

      expect(provider.fetcher).toBeInstanceOf(ComeetFetcher);
      expect(provider.mapper).toBeInstanceOf(ComeetMapper);
      expect(provider.normalizer).toBeInstanceOf(ComeetNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(DefaultSyncStrategy);
    });
  });

  describe('DefaultSyncStrategy for Comeet', () => {
    const strategy = new DefaultSyncStrategy('comeet');

    it('should have correct providerId', () => {
      expect(strategy.providerId).toBe('comeet');
    });

    it('should allow sync when state is healthy', () => {
      const state: ProviderState = {
        ...createInitialState('comeet'),
        health: 'healthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should not sync when state is unhealthy', () => {
      const state: ProviderState = {
        ...createInitialState('comeet'),
        health: 'unhealthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });
  });
});

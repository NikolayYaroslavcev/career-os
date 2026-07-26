import { describe, it, expect } from 'vitest';
import { createRemoteOKProvider } from '../remoteok-provider.js';
import { RemoteOKFetcher } from '../remoteok-fetcher.js';
import { RemoteOKMapper } from '../remoteok-mapper.js';
import { RemoteOKNormalizer } from '../remoteok-normalizer.js';
import { RemoteOKSyncStrategy } from '../remoteok-sync-strategy.js';
import type { ProviderState } from '../../../interfaces/provider-state.js';
import { createInitialState } from '../../../interfaces/provider-state.js';
import type { RawJob } from '../../../interfaces/raw-job.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('RemoteOKProvider', () => {
  describe('createRemoteOKProvider', () => {
    it('should create a provider with correct info', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createRemoteOKProvider({ logger, metrics, tracer });

      expect(provider.info.id).toBe('remote_ok');
      expect(provider.info.name).toBe('RemoteOK');
      expect(provider.info.version).toBe('1.0.0');
      expect(provider.info.supportsRemote).toBe(true);
    });

    it('should create a provider with correct capabilities', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createRemoteOKProvider({ logger, metrics, tracer });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('none');
      expect(provider.capabilities.sync.incremental).toBe(true);
      expect(provider.capabilities.rateLimits.perMinute).toBe(60);
    });

    it('should have all required components', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createRemoteOKProvider({ logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(RemoteOKFetcher);
      expect(provider.mapper).toBeInstanceOf(RemoteOKMapper);
      expect(provider.normalizer).toBeInstanceOf(RemoteOKNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(RemoteOKSyncStrategy);
    });
  });

  describe('RemoteOKMapper', () => {
    const mapper = new RemoteOKMapper();

    it('should have correct providerId', () => {
      expect(mapper.providerId).toBe('remote_ok');
    });

    it('should map raw job correctly', () => {
      const raw: RawJob = {
        sourceId: '12345',
        title: 'React Developer',
        description: 'A job description',
        companyName: 'Test Corp',
        location: 'Worldwide',
        technologies: ['react', 'javascript'],
        url: 'https://example.com/job/12345',
        publishedAt: new Date('2026-07-15'),
        remote: true,
        fetchedAt: new Date(),
      };

      const mapped = mapper.map(raw);

      expect(mapped.sourceId).toBe('12345');
      expect(mapped.title).toBe('React Developer');
      expect(mapped.companyName).toBe('Test Corp');
      expect(mapped.remote).toBe(true);
    });
  });

  describe('RemoteOKNormalizer', () => {
    const normalizer = new RemoteOKNormalizer();

    it('should have correct providerId', () => {
      expect(normalizer.providerId).toBe('remote_ok');
    });

    it('should validate required fields', () => {
      const validJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: { raw: 'Worldwide' },
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      expect(normalizer.validate(validJob)).toBeNull();

      expect(normalizer.validate({ ...validJob, sourceId: '' })).not.toBeNull();
      expect(normalizer.validate({ ...validJob, title: '' })).not.toBeNull();
      expect(normalizer.validate({ ...validJob, companyName: '' })).not.toBeNull();
      expect(normalizer.validate({ ...validJob, url: '' })).not.toBeNull();
    });
  });

  describe('RemoteOKSyncStrategy', () => {
    const strategy = new RemoteOKSyncStrategy();

    it('should have correct providerId', () => {
      expect(strategy.providerId).toBe('remote_ok');
    });

    it('should allow sync when state is healthy', () => {
      const state: ProviderState = {
        ...createInitialState('remote_ok'),
        health: 'healthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should not sync when state is unhealthy', () => {
      const state: ProviderState = {
        ...createInitialState('remote_ok'),
        health: 'unhealthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should not sync when consecutive failures >= 3', () => {
      const state: ProviderState = {
        ...createInitialState('remote_ok'),
        health: 'healthy',
        consecutiveFailures: 3,
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should not sync when nextSync is in the future', () => {
      const state: ProviderState = {
        ...createInitialState('remote_ok'),
        health: 'healthy',
        nextSync: new Date(Date.now() + 60_000),
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should sync when nextSync is in the past', () => {
      const state: ProviderState = {
        ...createInitialState('remote_ok'),
        health: 'healthy',
        nextSync: new Date(Date.now() - 1000),
      };

      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should return none cursor for full sync', () => {
      const cursor = strategy.getFullSyncCursor();

      expect(cursor.type).toBe('none');
    });

    it('should return timestamp cursor for incremental sync', () => {
      const state: ProviderState = createInitialState('remote_ok');
      const cursor = strategy.getIncrementalCursor(state);

      expect(cursor.type).toBe('timestamp');
    });
  });
});
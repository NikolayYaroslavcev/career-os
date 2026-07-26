import { describe, it, expect } from 'vitest';
import { RetryPolicy, DEFAULT_RETRY_CONFIG } from '../retry/retry-policy.js';
import { TokenBucketRateLimiter } from '../rate-limit/rate-limiter.js';
import { ProviderHealthMonitor } from '../health/provider-health-monitor.js';
import { DeduplicationEngine } from '../deduplication/deduplication-engine.js';
import { DefaultNormalizationPipeline } from '../normalization/normalization-pipeline.js';
import { ProviderRegistry } from '../registry/provider-registry.js';
import { createRemoteOKProvider } from '../providers/remoteok/remoteok-provider.js';
import { ProviderErrorType } from '../errors/provider-errors.js';
import type { ProviderResult } from '../interfaces/result.js';
import type { NormalizedVacancy } from '../interfaces/normalized-vacancy.js';

describe('SDK Integration with RemoteOK Provider', () => {
  describe('RetryPolicy', () => {
    it('should retry on retryable errors', async () => {
      const policy = new RetryPolicy({
        ...DEFAULT_RETRY_CONFIG,
        maxAttempts: 3,
        baseDelayMs: 10,
        jitter: false,
      });

      let attempts = 0;
      const operation = async (): Promise<ProviderResult<string>> => {
        attempts++;
        if (attempts < 3) {
          return {
            ok: false,
            error: ProviderErrorType.NETWORK_ERROR,
            message: 'Network error',
            retryable: true,
            meta: { durationMs: 0 },
          };
        }
        return {
          ok: true,
          data: 'success',
          meta: { durationMs: 0 },
        };
      };

      const result = await policy.execute(operation, {
        providerId: 'remoteok',
        operation: 'fetch',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('success');
      }
      expect(attempts).toBe(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const policy = new RetryPolicy({
        ...DEFAULT_RETRY_CONFIG,
        maxAttempts: 3,
        baseDelayMs: 10,
      });

      let attempts = 0;
      const operation = async (): Promise<ProviderResult<string>> => {
        attempts++;
        return {
          ok: false,
          error: ProviderErrorType.AUTHENTICATION_ERROR,
          message: 'Auth failed',
          retryable: false,
          meta: { durationMs: 0 },
        };
      };

      const result = await policy.execute(operation, {
        providerId: 'remoteok',
        operation: 'fetch',
      });

      expect(result.ok).toBe(false);
      expect(attempts).toBe(1);
    });
  });

  describe('TokenBucketRateLimiter', () => {
    it('should acquire tokens within capacity', async () => {
      const limiter = new TokenBucketRateLimiter({
        capacity: 5,
        refillRate: 1,
        refillIntervalMs: 1000,
      });

      const results = await Promise.all([
        limiter.acquire('remoteok'),
        limiter.acquire('remoteok'),
        limiter.acquire('remoteok'),
      ]);

      expect(results.every((r) => r === true)).toBe(true);
    });

    it('should reject when capacity exceeded', async () => {
      const limiter = new TokenBucketRateLimiter({
        capacity: 2,
        refillRate: 1,
        refillIntervalMs: 10_000,
      });

      await limiter.acquire('remoteok');
      await limiter.acquire('remoteok');
      const result = await limiter.acquire('remoteok');

      expect(result).toBe(false);
    });

    it('should track bucket status', async () => {
      const limiter = new TokenBucketRateLimiter({
        capacity: 5,
        refillRate: 1,
        refillIntervalMs: 1000,
      });

      await limiter.acquire('remoteok');
      await limiter.acquire('remoteok');

      const status = limiter.getStatus('remoteok');
      expect(status.available).toBe(3);
      expect(status.capacity).toBe(5);
    });
  });

  describe('ProviderHealthMonitor', () => {
    it('should check provider health', async () => {
      const monitor = new ProviderHealthMonitor({
        checkIntervalMs: 60_000,
        unhealthyThreshold: 3,
        degradedThresholdMs: 5000,
        healthyThresholdMs: 1000,
      });

      const mockConfig = {
        baseUrl: 'https://remoteok.com/api',
        logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        metrics: { incrementCounter: () => {}, recordHistogram: () => {}, setGauge: () => {} },
        tracer: { startSpan: () => ({ setAttribute: () => {}, addEvent: () => {}, end: () => {}, traceId: '', spanId: '', name: '' }) },
      };

      const provider = createRemoteOKProvider(mockConfig);
      await provider.initialize({});

      const result = await monitor.checkProvider(provider);

      expect(result.providerId).toBe('remote_ok');
      expect(result.healthy).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.checkedAt).toBeInstanceOf(Date);

      await provider.dispose();
    });

    it('should track health history', async () => {
      const monitor = new ProviderHealthMonitor({
        checkIntervalMs: 60_000,
        unhealthyThreshold: 3,
        degradedThresholdMs: 5000,
        healthyThresholdMs: 1000,
      });

      const mockConfig = {
        baseUrl: 'https://remoteok.com/api',
        logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        metrics: { incrementCounter: () => {}, recordHistogram: () => {}, setGauge: () => {} },
        tracer: { startSpan: () => ({ setAttribute: () => {}, addEvent: () => {}, end: () => {}, traceId: '', spanId: '', name: '' }) },
      };

      const provider = createRemoteOKProvider(mockConfig);
      await provider.initialize({});

      await monitor.checkProvider(provider);
      await monitor.checkProvider(provider);

      const history = monitor.getHistory('remote_ok');
      expect(history.length).toBe(2);

      await provider.dispose();
    });
  });

  describe('DeduplicationEngine', () => {
    it('should deduplicate identical vacancies', () => {
      const engine = new DeduplicationEngine({
        keyFields: ['sourceId', 'companyName', 'title'],
        similarityThreshold: 1,
        timeWindowMs: 86_400_000,
      });

      const job: NormalizedVacancy = {
        id: 'remoteok:12345',
        source: 'remoteok',
        sourceId: '12345',
        title: 'React Developer',
        description: 'desc',
        companyName: 'Acme Corp',
        location: { raw: 'Worldwide', remoteEligible: true },
        technologies: ['react'],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        remote: { level: 'remote_only', explicit: true },
        normalizedAt: new Date(),
        contentHash: 'abc123',
      };

      const duplicate = { ...job, id: 'remoteok:12345-copy' };
      const unique = { ...job, id: 'remoteok:99999', sourceId: '99999', title: 'Vue Developer' };

      const result = engine.deduplicate([job, duplicate, unique]);

      expect(result.unique.length).toBe(2);
      expect(result.duplicates.length).toBe(1);
      expect(result.stats.totalInput).toBe(3);
      expect(result.stats.uniqueOutput).toBe(2);
      expect(result.stats.duplicatesFound).toBe(1);
    });
  });

  describe('DefaultNormalizationPipeline', () => {
    it('should normalize experience levels', () => {
      const pipeline = new DefaultNormalizationPipeline();

      const job = {
        sourceId: '1',
        title: 'Senior React Developer',
        description: 'desc',
        companyName: 'Company',
        location: { raw: 'Worldwide' },
        technologies: ['react'],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = pipeline.normalize('remoteok', job);
      expect(result.experienceLevel).toBe('senior');
    });

    it('should normalize employment types', () => {
      const pipeline = new DefaultNormalizationPipeline();

      const job = {
        sourceId: '1',
        title: 'Contract Developer',
        description: 'desc',
        companyName: 'Company',
        location: { raw: 'Worldwide' },
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = pipeline.normalize('remoteok', job);
      expect(result.employmentType).toBe('contract');
    });

    it('should generate content hash', () => {
      const pipeline = new DefaultNormalizationPipeline();

      const job = {
        sourceId: '1',
        title: 'React Developer',
        description: 'desc',
        companyName: 'Company',
        location: { raw: 'Worldwide' },
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = pipeline.normalize('remoteok', job);
      expect(result.contentHash).toBeDefined();
      expect(typeof result.contentHash).toBe('string');
    });
  });

  describe('ProviderRegistry', () => {
    it('should register and retrieve provider', () => {
      const registry = new ProviderRegistry();
      const mockConfig = {
        baseUrl: 'https://remoteok.com/api',
        logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        metrics: { incrementCounter: () => {}, recordHistogram: () => {}, setGauge: () => {} },
        tracer: { startSpan: () => ({ setAttribute: () => {}, addEvent: () => {}, end: () => {}, traceId: '', spanId: '', name: '' }) },
      };

      const provider = createRemoteOKProvider(mockConfig);

      registry.register(provider);

      const retrieved = registry.get('remote_ok');
      expect(retrieved.info.id).toBe('remote_ok');
    });

    it('should throw when getting non-existent provider', () => {
      const registry = new ProviderRegistry();

      expect(() => registry.get('nonexistent')).toThrow();
    });

    it('should list all registered providers', () => {
      const registry = new ProviderRegistry();
      const mockConfig = {
        baseUrl: 'https://remoteok.com/api',
        logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        metrics: { incrementCounter: () => {}, recordHistogram: () => {}, setGauge: () => {} },
        tracer: { startSpan: () => ({ setAttribute: () => {}, addEvent: () => {}, end: () => {}, traceId: '', spanId: '', name: '' }) },
      };

      const provider = createRemoteOKProvider(mockConfig);

      registry.register(provider);

      const all = registry.getAll();
      expect(all.length).toBe(1);
      expect(all[0]?.info.id).toBe('remote_ok');
    });

    it('should initialize all providers', async () => {
      const registry = new ProviderRegistry();
      const mockConfig = {
        baseUrl: 'https://remoteok.com/api',
        logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        metrics: { incrementCounter: () => {}, recordHistogram: () => {}, setGauge: () => {} },
        tracer: { startSpan: () => ({ setAttribute: () => {}, addEvent: () => {}, end: () => {}, traceId: '', spanId: '', name: '' }) },
      };

      const provider = createRemoteOKProvider(mockConfig);

      registry.register(provider);
      await registry.initializeAll(new Map());

      expect(registry.isReady('remote_ok')).toBe(true);
    });

    it('should dispose all providers', async () => {
      const registry = new ProviderRegistry();
      const mockConfig = {
        baseUrl: 'https://remoteok.com/api',
        logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        metrics: { incrementCounter: () => {}, recordHistogram: () => {}, setGauge: () => {} },
        tracer: { startSpan: () => ({ setAttribute: () => {}, addEvent: () => {}, end: () => {}, traceId: '', spanId: '', name: '' }) },
      };

      const provider = createRemoteOKProvider(mockConfig);

      registry.register(provider);
      await registry.initializeAll(new Map());
      await registry.disposeAll();

      expect(registry.isReady('remote_ok')).toBe(false);
    });
  });
});

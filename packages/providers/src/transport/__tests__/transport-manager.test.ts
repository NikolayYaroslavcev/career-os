import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransportManager } from '../transport-manager.js';
import { SocialMessageTransportRegistry, TransportNotFoundError } from '../../registry/social-message-transport-registry.js';
import { RetryPolicy } from '../../retry/retry-policy.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import { NoopLogger } from '../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../observability/metrics.js';
import { InMemoryTracer } from '../../observability/tracer.js';
import type {
  SocialMessageTransport,
  SocialMessageCandidate,
  SocialMessageValidationError,
  TransportSource,
  TransportFetchResult,
} from '../../interfaces/social-message-transport.js';
import type { ProviderResult } from '../../interfaces/result.js';

function candidate(overrides: Partial<SocialMessageCandidate> = {}): SocialMessageCandidate {
  return {
    sourceId: 'channel',
    externalMessageId: '1',
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    rawText: 'We are hiring a developer',
    links: [],
    ...overrides,
  };
}

function fetchResult(messages: readonly SocialMessageCandidate[]): ProviderResult<TransportFetchResult> {
  return { ok: true, data: { messages, hasMore: false, meta: {} }, meta: { durationMs: 10 } };
}

class FakeTransport implements SocialMessageTransport {
  readonly transportType: string;
  readonly capability: SocialMessageTransport['capability'];
  fetch: ReturnType<typeof vi.fn>;
  validate = vi.fn((_candidate: SocialMessageCandidate): SocialMessageValidationError | null => null);

  constructor(transportType = 'FAKE', capability: SocialMessageTransport['capability'] = 'PULL') {
    this.transportType = transportType;
    this.capability = capability;
    this.fetch = vi.fn();
  }
}

const source: TransportSource = { sourceId: 'channel' };

describe('TransportManager', () => {
  let registry: SocialMessageTransportRegistry;
  let logger: NoopLogger;
  let metrics: InMemoryMetricsCollector;
  let tracer: InMemoryTracer;

  beforeEach(() => {
    registry = new SocialMessageTransportRegistry();
    logger = new NoopLogger();
    metrics = new InMemoryMetricsCollector();
    tracer = new InMemoryTracer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('transport selection', () => {
    it('resolves the registered transport for a provider and fetches through it', async () => {
      const transport = new FakeTransport();
      transport.fetch.mockResolvedValue(fetchResult([candidate()]));
      registry.register('telegram', transport);

      const manager = new TransportManager({ registry, logger, metrics, tracer });
      const result = await manager.fetch('telegram', source);

      expect(result.ok).toBe(true);
      expect(transport.fetch).toHaveBeenCalledWith(source, undefined);
    });

    it('resolves by capability when multiple transports are registered for a provider', async () => {
      const pull = new FakeTransport('HTML_PREVIEW', 'PULL');
      const api = new FakeTransport('BOT_API', 'API');
      pull.fetch.mockResolvedValue(fetchResult([candidate()]));
      api.fetch.mockResolvedValue(fetchResult([candidate({ externalMessageId: '2' })]));
      registry.register('telegram', api);
      registry.register('telegram', pull);

      const manager = new TransportManager({ registry, logger, metrics, tracer });
      const result = await manager.fetch('telegram', source, { capability: 'PULL' });

      expect(result.ok).toBe(true);
      expect(pull.fetch).toHaveBeenCalledTimes(1);
      expect(api.fetch).not.toHaveBeenCalled();
    });

    it('returns a non-retryable CONFIGURATION_ERROR when no transport is registered', async () => {
      const manager = new TransportManager({ registry, logger, metrics, tracer });
      const result = await manager.fetch('unknown-provider', source);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(ProviderErrorType.CONFIGURATION_ERROR);
        expect(result.retryable).toBe(false);
      }
    });

    it('propagates TransportNotFoundError semantics from the registry for a missing capability', async () => {
      const transport = new FakeTransport('HTML_PREVIEW', 'PULL');
      registry.register('telegram', transport);
      expect(() => registry.resolve('telegram', 'API')).toThrow(TransportNotFoundError);
    });
  });

  describe('retry orchestration', () => {
    it('retries a failing transport up to the configured attempts and eventually succeeds', async () => {
      vi.useFakeTimers();
      const transport = new FakeTransport();
      transport.fetch
        .mockRejectedValueOnce(new Error('network blip'))
        .mockResolvedValueOnce(fetchResult([candidate()]));
      registry.register('telegram', transport);

      const manager = new TransportManager({
        registry,
        logger,
        metrics,
        tracer,
        retryPolicy: new RetryPolicy({ maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, jitter: false, retryableErrors: new Set([ProviderErrorType.NETWORK_ERROR]) }),
      });

      const resultPromise = manager.fetch('telegram', source);
      await vi.advanceTimersByTimeAsync(50);
      const result = await resultPromise;

      expect(result.ok).toBe(true);
      expect(transport.fetch).toHaveBeenCalledTimes(2);
    });

    it('gives up after exhausting retries and reports the failure', async () => {
      vi.useFakeTimers();
      const transport = new FakeTransport();
      transport.fetch.mockRejectedValue(new Error('always fails'));
      registry.register('telegram', transport);

      const manager = new TransportManager({
        registry,
        logger,
        metrics,
        tracer,
        retryPolicy: new RetryPolicy({ maxAttempts: 2, baseDelayMs: 5, maxDelayMs: 20, backoffMultiplier: 2, jitter: false, retryableErrors: new Set([ProviderErrorType.NETWORK_ERROR]) }),
      });

      const resultPromise = manager.fetch('telegram', source);
      await vi.advanceTimersByTimeAsync(50);
      const result = await resultPromise;

      expect(result.ok).toBe(false);
      expect(transport.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('timeout handling', () => {
    it('fails a transport call that never resolves once the timeout elapses', async () => {
      vi.useFakeTimers();
      const transport = new FakeTransport();
      transport.fetch.mockImplementation(() => new Promise(() => {})); // never resolves
      registry.register('telegram', transport);

      const manager = new TransportManager({
        registry,
        logger,
        metrics,
        tracer,
        timeoutMs: 100,
        retryPolicy: new RetryPolicy({ maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1, backoffMultiplier: 1, jitter: false, retryableErrors: new Set([ProviderErrorType.NETWORK_ERROR]) }),
      });

      const resultPromise = manager.fetch('telegram', source);
      await vi.advanceTimersByTimeAsync(150);
      const result = await resultPromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(ProviderErrorType.NETWORK_ERROR);
        expect(result.message).toMatch(/timed out/i);
      }
    });
  });

  describe('invalid message rejection', () => {
    it('drops candidates that fail validate() without failing the whole fetch', async () => {
      const transport = new FakeTransport();
      const good = candidate({ externalMessageId: '1' });
      const bad = candidate({ externalMessageId: '2', rawText: '' });
      transport.fetch.mockResolvedValue(fetchResult([good, bad]));
      transport.validate.mockImplementation((c: SocialMessageCandidate) =>
        c.rawText.trim().length === 0 ? { field: 'rawText', message: 'empty', severity: 'error' as const } : null,
      );
      registry.register('telegram', transport);

      const manager = new TransportManager({ registry, logger, metrics, tracer });
      const result = await manager.fetch('telegram', source);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.messages).toHaveLength(1);
        expect(result.data.messages[0]?.externalMessageId).toBe('1');
      }
      expect(metrics.getCounter('transport.messages.rejected')).toBe(1);
    });
  });

  describe('metrics emission', () => {
    it('records fetch duration, success count, and fetched message count on success', async () => {
      const transport = new FakeTransport();
      transport.fetch.mockResolvedValue(fetchResult([candidate()]));
      registry.register('telegram', transport);

      const manager = new TransportManager({ registry, logger, metrics, tracer });
      await manager.fetch('telegram', source);

      expect(metrics.getCounter('transport.fetch.success')).toBe(1);
      expect(metrics.getCounter('transport.messages.fetched')).toBe(1);
      expect(metrics.getHistogram('transport.fetch.duration_ms')).toHaveLength(1);
    });

    it('records a failure counter when the transport ultimately fails', async () => {
      const transport = new FakeTransport();
      transport.fetch.mockRejectedValue(new Error('boom'));
      registry.register('telegram', transport);

      const manager = new TransportManager({
        registry,
        logger,
        metrics,
        tracer,
        retryPolicy: new RetryPolicy({ maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1, backoffMultiplier: 1, jitter: false, retryableErrors: new Set([ProviderErrorType.NETWORK_ERROR]) }),
      });
      await manager.fetch('telegram', source);

      expect(metrics.getCounter('transport.fetch.failure')).toBe(1);
    });
  });

  describe('tracing', () => {
    it('starts and ends a span per fetch attempt', async () => {
      const transport = new FakeTransport();
      transport.fetch.mockResolvedValue(fetchResult([candidate()]));
      registry.register('telegram', transport);

      const manager = new TransportManager({ registry, logger, metrics, tracer });
      await manager.fetch('telegram', source);

      const span = tracer.getSpanByName('transport.fetch');
      expect(span).toBeDefined();
    });
  });

  describe('health reporting', () => {
    it('reports unknown health before any fetch has happened', () => {
      const manager = new TransportManager({ registry, logger, metrics, tracer });
      const health = manager.getHealth('telegram', 'HTML_PREVIEW');
      expect(health.state).toBe('unknown');
    });

    it('reports healthy after a successful fetch', async () => {
      const transport = new FakeTransport('HTML_PREVIEW');
      transport.fetch.mockResolvedValue(fetchResult([candidate()]));
      registry.register('telegram', transport);

      const manager = new TransportManager({ registry, logger, metrics, tracer });
      await manager.fetch('telegram', source);

      const health = manager.getHealth('telegram', 'HTML_PREVIEW');
      expect(health.state).toBe('healthy');
      expect(health.consecutiveSuccesses).toBe(1);
    });

    it('reports unhealthy after crossing the consecutive-failure threshold', async () => {
      const transport = new FakeTransport('HTML_PREVIEW');
      transport.fetch.mockRejectedValue(new Error('down'));
      registry.register('telegram', transport);

      const manager = new TransportManager({
        registry,
        logger,
        metrics,
        tracer,
        unhealthyThreshold: 2,
        retryPolicy: new RetryPolicy({ maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1, backoffMultiplier: 1, jitter: false, retryableErrors: new Set([ProviderErrorType.NETWORK_ERROR]) }),
      });

      await manager.fetch('telegram', source);
      await manager.fetch('telegram', source);

      const health = manager.getHealth('telegram', 'HTML_PREVIEW');
      expect(health.state).toBe('unhealthy');
      expect(health.consecutiveFailures).toBe(2);
    });

    it('lists health for every provider/transport pair that has been fetched', async () => {
      const transport = new FakeTransport('HTML_PREVIEW');
      transport.fetch.mockResolvedValue(fetchResult([candidate()]));
      registry.register('telegram', transport);

      const manager = new TransportManager({ registry, logger, metrics, tracer });
      await manager.fetch('telegram', source);

      expect(manager.getAllHealth()).toHaveLength(1);
    });
  });

  describe('transport lifecycle', () => {
    it('starts and stops lifecycle-capable transports exactly once', async () => {
      const start = vi.fn().mockResolvedValue(undefined);
      const stop = vi.fn().mockResolvedValue(undefined);
      const transport = Object.assign(new FakeTransport('BOT_API', 'API'), { start, stop });
      registry.register('telegram', transport);

      const manager = new TransportManager({ registry, logger, metrics, tracer });
      await manager.start();
      await manager.start(); // idempotent
      await manager.stop();
      await manager.stop(); // idempotent

      expect(start).toHaveBeenCalledTimes(1);
      expect(stop).toHaveBeenCalledTimes(1);
    });

    it('never calls start()/stop() on transports without a lifecycle', async () => {
      const transport = new FakeTransport();
      registry.register('telegram', transport);

      const manager = new TransportManager({ registry, logger, metrics, tracer });
      await expect(manager.start()).resolves.toBeUndefined();
      await expect(manager.stop()).resolves.toBeUndefined();
    });
  });
});

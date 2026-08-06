import type { SocialMessageTransportRegistry } from '../registry/social-message-transport-registry.js';
import type { TransportCapability } from '../interfaces/transport-capability.js';
import type {
  SocialMessageTransport,
  TransportSource,
  TransportCursor,
  TransportFetchResult,
  SocialMessageCandidate,
  SocialMessageValidationError,
} from '../interfaces/social-message-transport.js';
import type { ProviderResult } from '../interfaces/result.js';
import { ProviderErrorType } from '../errors/provider-errors.js';
import { RetryPolicy, DEFAULT_RETRY_CONFIG } from '../retry/retry-policy.js';
import type { Logger } from '../observability/logger.js';
import type { MetricsCollector } from '../observability/metrics.js';
import { TRANSPORT_METRICS } from '../observability/metrics.js';
import type { Tracer } from '../observability/tracer.js';

/**
 * Optional lifecycle a transport may implement (e.g. BotApiTransport starting/
 * stopping its push-update buffering). Duck-typed rather than added to
 * `SocialMessageTransport` itself, because most transports (HtmlPreviewTransport)
 * are stateless per-call and have nothing to start or stop.
 */
export interface TransportLifecycle {
  start(): Promise<void>;
  stop(): Promise<void>;
}

function hasLifecycle(transport: SocialMessageTransport): transport is SocialMessageTransport & TransportLifecycle {
  const candidate = transport as Partial<TransportLifecycle>;
  return typeof candidate.start === 'function' && typeof candidate.stop === 'function';
}

export type TransportHealthState = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface TransportHealth {
  readonly providerId: string;
  readonly transportType: string;
  readonly state: TransportHealthState;
  readonly consecutiveFailures: number;
  readonly consecutiveSuccesses: number;
  readonly lastCheckedAt?: Date;
  readonly lastError?: string;
  readonly avgLatencyMs: number;
}

export interface TransportManagerConfig {
  readonly registry: SocialMessageTransportRegistry;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
  /** Defaults to DEFAULT_RETRY_CONFIG (reused from packages/providers/src/retry/retry-policy.ts). */
  readonly retryPolicy?: RetryPolicy;
  /** Whole-operation timeout enforced around a transport's fetch() call. Individual transports may have their own inner timeouts (e.g. resilientFetch) — this is the outer safety net. */
  readonly timeoutMs?: number;
  /** Consecutive failures before a transport is reported unhealthy. */
  readonly unhealthyThreshold?: number;
  /** Latency above which a healthy transport is reported degraded. */
  readonly degradedThresholdMs?: number;
}

export interface TransportFetchOptions {
  readonly capability?: TransportCapability;
  readonly cursor?: TransportCursor;
}

class TransportTimeoutError extends Error {}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_UNHEALTHY_THRESHOLD = 3;
const DEFAULT_DEGRADED_THRESHOLD_MS = 5_000;
const HEALTH_HISTORY_LIMIT = 20;

interface HealthRecord {
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckedAt?: Date;
  lastError?: string;
  latencies: number[];
}

function healthKey(providerId: string, transportType: string): string {
  return `${providerId}:${transportType}`;
}

/**
 * Owns everything a caller of a SocialMessageTransport shouldn't have to
 * reimplement per-provider: which transport to use (delegates to
 * SocialMessageTransportRegistry), retrying failures (reuses RetryPolicy),
 * bounding how long a fetch is allowed to run, emitting metrics/traces/logs,
 * tracking per-transport health, and starting/stopping transports that have a
 * lifecycle. It never maps, normalizes, extracts, deduplicates, or persists —
 * same boundary SocialMessageTransport itself documents.
 */
export class TransportManager {
  private readonly registry: SocialMessageTransportRegistry;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;
  private readonly retryPolicy: RetryPolicy;
  private readonly timeoutMs: number;
  private readonly unhealthyThreshold: number;
  private readonly degradedThresholdMs: number;
  private readonly health = new Map<string, HealthRecord>();
  private readonly started = new Set<SocialMessageTransport>();

  constructor(config: TransportManagerConfig) {
    this.registry = config.registry;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
    this.retryPolicy = config.retryPolicy ?? new RetryPolicy(DEFAULT_RETRY_CONFIG);
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.unhealthyThreshold = config.unhealthyThreshold ?? DEFAULT_UNHEALTHY_THRESHOLD;
    this.degradedThresholdMs = config.degradedThresholdMs ?? DEFAULT_DEGRADED_THRESHOLD_MS;
  }

  /**
   * Resolves the right transport for `providerId` (optionally scoped to a
   * capability), fetches through retry + timeout, validates every returned
   * candidate, and reports health/metrics/tracing for the attempt. Invalid
   * candidates are dropped (never returned to the caller) rather than failing
   * the whole fetch, since one malformed post shouldn't sink an entire batch.
   */
  async fetch(
    providerId: string,
    source: TransportSource,
    options: TransportFetchOptions = {},
  ): Promise<ProviderResult<TransportFetchResult>> {
    const span = this.tracer.startSpan('transport.fetch', { providerId, sourceId: source.sourceId });
    const startedAt = Date.now();

    let transport: SocialMessageTransport;
    try {
      transport = this.registry.resolve(providerId, options.capability);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('No transport available', error instanceof Error ? error : undefined, { providerId, operation: 'transport.fetch' });
      span.setAttribute('error', true);
      span.end();
      return {
        ok: false,
        error: ProviderErrorType.CONFIGURATION_ERROR,
        message,
        retryable: false,
        meta: { durationMs: Date.now() - startedAt },
      };
    }

    span.setAttribute('transportType', transport.transportType);
    span.setAttribute('capability', transport.capability);

    const operation = (): Promise<ProviderResult<TransportFetchResult>> =>
      this.fetchOnce(transport, source, options.cursor);

    const result = await this.retryPolicy.execute(operation, {
      providerId,
      operation: `transport.fetch:${transport.transportType}`,
    });

    const durationMs = Date.now() - startedAt;

    if (result.ok) {
      const { valid, rejected } = this.partitionByValidity(transport, result.data.messages);

      this.recordSuccess(providerId, transport.transportType, durationMs);
      this.metrics.recordHistogram(TRANSPORT_METRICS.FETCH_DURATION, durationMs, { providerId, transportType: transport.transportType });
      this.metrics.incrementCounter(TRANSPORT_METRICS.FETCH_SUCCESS, 1, { providerId, transportType: transport.transportType });
      this.metrics.incrementCounter(TRANSPORT_METRICS.MESSAGES_FETCHED, valid.length, { providerId, transportType: transport.transportType });
      if (rejected.length > 0) {
        this.metrics.incrementCounter(TRANSPORT_METRICS.MESSAGES_REJECTED, rejected.length, { providerId, transportType: transport.transportType });
        this.logger.warn('Transport produced invalid candidates; dropping them', {
          providerId,
          operation: 'transport.fetch',
          transportType: transport.transportType,
          rejectedCount: rejected.length,
          reasons: rejected.map((r) => `${r.candidate.externalMessageId}:${r.error.field}`).join(','),
        });
      }

      span.setAttribute('messages.valid', valid.length);
      span.setAttribute('messages.rejected', rejected.length);
      span.end();

      return {
        ok: true,
        data: { ...result.data, messages: valid },
        // transportType is surfaced via providerMeta (not just internally via
        // metrics tags/spans) so callers that persist SocialMessage rows can
        // record which transport served the request without reaching into
        // TransportManager internals.
        meta: {
          ...result.meta,
          durationMs,
          providerMeta: { ...result.meta.providerMeta, transportType: transport.transportType },
        },
      };
    }

    this.recordFailure(providerId, transport.transportType, result.message);
    this.metrics.incrementCounter(TRANSPORT_METRICS.FETCH_FAILURE, 1, { providerId, transportType: transport.transportType });
    this.logger.error('Transport fetch failed', undefined, {
      providerId,
      operation: 'transport.fetch',
      transportType: transport.transportType,
      error: result.message,
    });

    span.setAttribute('error', true);
    span.end();

    return { ...result, meta: { ...result.meta, durationMs } };
  }

  private async fetchOnce(
    transport: SocialMessageTransport,
    source: TransportSource,
    cursor: TransportCursor | undefined,
  ): Promise<ProviderResult<TransportFetchResult>> {
    const attemptStart = Date.now();
    try {
      return await this.withTimeout(transport.fetch(source, cursor), this.timeoutMs);
    } catch (error) {
      const timedOut = error instanceof TransportTimeoutError;
      if (timedOut) {
        this.metrics.incrementCounter(TRANSPORT_METRICS.FETCH_TIMEOUT, 1, { transportType: transport.transportType });
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: ProviderErrorType.NETWORK_ERROR,
        message,
        retryable: true,
        meta: { durationMs: Date.now() - attemptStart },
      };
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new TransportTimeoutError(`Transport fetch timed out after ${timeoutMs}ms`)), timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  private partitionByValidity(
    transport: SocialMessageTransport,
    messages: readonly SocialMessageCandidate[],
  ): { valid: SocialMessageCandidate[]; rejected: Array<{ candidate: SocialMessageCandidate; error: SocialMessageValidationError }> } {
    const valid: SocialMessageCandidate[] = [];
    const rejected: Array<{ candidate: SocialMessageCandidate; error: SocialMessageValidationError }> = [];

    for (const candidate of messages) {
      const error = transport.validate(candidate);
      if (error) {
        rejected.push({ candidate, error });
      } else {
        valid.push(candidate);
      }
    }

    return { valid, rejected };
  }

  // --- Health ---------------------------------------------------------

  getHealth(providerId: string, transportType: string): TransportHealth {
    const record = this.health.get(healthKey(providerId, transportType));
    if (!record) {
      return {
        providerId,
        transportType,
        state: 'unknown',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        avgLatencyMs: 0,
      };
    }
    return {
      providerId,
      transportType,
      state: this.deriveState(record),
      consecutiveFailures: record.consecutiveFailures,
      consecutiveSuccesses: record.consecutiveSuccesses,
      lastCheckedAt: record.lastCheckedAt,
      lastError: record.lastError,
      avgLatencyMs: this.averageLatency(record),
    };
  }

  getAllHealth(): readonly TransportHealth[] {
    return Array.from(this.health.entries()).map(([key, record]) => {
      const [providerId, transportType] = key.split(':') as [string, string];
      return {
        providerId,
        transportType,
        state: this.deriveState(record),
        consecutiveFailures: record.consecutiveFailures,
        consecutiveSuccesses: record.consecutiveSuccesses,
        lastCheckedAt: record.lastCheckedAt,
        lastError: record.lastError,
        avgLatencyMs: this.averageLatency(record),
      };
    });
  }

  private recordSuccess(providerId: string, transportType: string, latencyMs: number): void {
    const key = healthKey(providerId, transportType);
    const record = this.health.get(key) ?? this.emptyRecord();
    record.consecutiveFailures = 0;
    record.consecutiveSuccesses += 1;
    record.lastCheckedAt = new Date();
    record.lastError = undefined;
    record.latencies.push(latencyMs);
    if (record.latencies.length > HEALTH_HISTORY_LIMIT) record.latencies.shift();
    this.health.set(key, record);
    this.metrics.setGauge(TRANSPORT_METRICS.HEALTH_STATE, this.stateToGauge(this.deriveState(record)), { providerId, transportType });
  }

  private recordFailure(providerId: string, transportType: string, error: string): void {
    const key = healthKey(providerId, transportType);
    const record = this.health.get(key) ?? this.emptyRecord();
    record.consecutiveSuccesses = 0;
    record.consecutiveFailures += 1;
    record.lastCheckedAt = new Date();
    record.lastError = error;
    this.health.set(key, record);
    this.metrics.setGauge(TRANSPORT_METRICS.HEALTH_STATE, this.stateToGauge(this.deriveState(record)), { providerId, transportType });
  }

  private emptyRecord(): HealthRecord {
    return { consecutiveFailures: 0, consecutiveSuccesses: 0, latencies: [] };
  }

  private deriveState(record: HealthRecord): TransportHealthState {
    if (record.consecutiveFailures >= this.unhealthyThreshold) return 'unhealthy';
    if (!record.lastCheckedAt) return 'unknown';
    const avgLatency = this.averageLatency(record);
    if (avgLatency > this.degradedThresholdMs) return 'degraded';
    return 'healthy';
  }

  private averageLatency(record: HealthRecord): number {
    if (record.latencies.length === 0) return 0;
    return record.latencies.reduce((sum, v) => sum + v, 0) / record.latencies.length;
  }

  private stateToGauge(state: TransportHealthState): number {
    switch (state) {
      case 'healthy':
        return 1;
      case 'degraded':
        return 0.5;
      case 'unhealthy':
        return 0;
      default:
        return -1;
    }
  }

  // --- Lifecycle --------------------------------------------------------

  /** Starts every lifecycle-capable transport (optionally scoped to one provider). Idempotent per transport instance. */
  async start(providerId?: string): Promise<void> {
    for (const transport of this.transportsFor(providerId)) {
      if (hasLifecycle(transport) && !this.started.has(transport)) {
        await transport.start();
        this.started.add(transport);
        this.logger.info('Transport started', { operation: 'transport.start', transportType: transport.transportType });
      }
    }
  }

  /** Stops every lifecycle-capable transport this manager started (optionally scoped to one provider). */
  async stop(providerId?: string): Promise<void> {
    for (const transport of this.transportsFor(providerId)) {
      if (hasLifecycle(transport) && this.started.has(transport)) {
        await transport.stop();
        this.started.delete(transport);
        this.logger.info('Transport stopped', { operation: 'transport.stop', transportType: transport.transportType });
      }
    }
  }

  private transportsFor(providerId?: string): readonly SocialMessageTransport[] {
    if (providerId) return this.registry.getForProvider(providerId);
    // SocialMessageTransportRegistry has no getAllProviders(); PULL/PUSH/API/
    // BROWSER/FILE/STREAM together cover every registered transport exactly
    // once each, since a transport has exactly one capability.
    const capabilities: TransportCapability[] = ['PULL', 'PUSH', 'API', 'BROWSER', 'FILE', 'STREAM'];
    const seen = new Set<SocialMessageTransport>();
    for (const capability of capabilities) {
      for (const transport of this.registry.getByCapability(capability)) {
        seen.add(transport);
      }
    }
    return Array.from(seen);
  }
}

export interface AIProviderHealthConfig {
  /** Consecutive failures before a provider is considered unhealthy. */
  readonly unhealthyThreshold: number;
  /** How long an unhealthy provider is skipped before being retried (half-open). */
  readonly recoveryAfterMs: number;
  /** How many recent latency samples to average over. */
  readonly latencyWindowSize: number;
}

export const DEFAULT_AI_PROVIDER_HEALTH_CONFIG: AIProviderHealthConfig = {
  unhealthyThreshold: 3,
  recoveryAfterMs: 30_000,
  latencyWindowSize: 10,
};

export type AIProviderHealthState = 'healthy' | 'unhealthy';

export interface AIProviderHealthStatus {
  readonly providerName: string;
  readonly state: AIProviderHealthState;
  readonly consecutiveFailures: number;
  readonly avgLatencyMs: number;
  readonly lastCheckedAt: Date;
}

interface ProviderHealthRecord {
  consecutiveFailures: number;
  unhealthySince: number | undefined;
  latencies: number[];
  lastCheckedAt: Date;
}

/**
 * Tracks per-provider health from live complete() outcomes (success/failure +
 * latency) rather than a separate active health-check ping — there's no cheap
 * no-op endpoint to poll on an LLM API. Backs FallbackAIProvider's
 * circuit-breaker-style skip/recover behavior.
 */
export class AIProviderHealthMonitor {
  private readonly records = new Map<string, ProviderHealthRecord>();

  constructor(private readonly config: AIProviderHealthConfig = DEFAULT_AI_PROVIDER_HEALTH_CONFIG) {}

  recordSuccess(providerName: string, latencyMs: number): void {
    const record = this.getOrCreate(providerName);
    record.consecutiveFailures = 0;
    record.unhealthySince = undefined;
    record.latencies.push(latencyMs);
    if (record.latencies.length > this.config.latencyWindowSize) {
      record.latencies.shift();
    }
    record.lastCheckedAt = new Date();
  }

  recordFailure(providerName: string): void {
    const record = this.getOrCreate(providerName);
    record.consecutiveFailures += 1;
    if (record.consecutiveFailures >= this.config.unhealthyThreshold && record.unhealthySince === undefined) {
      record.unhealthySince = Date.now();
    }
    record.lastCheckedAt = new Date();
  }

  /**
   * True when the provider hasn't crossed the unhealthy threshold, or when it
   * has but enough time has passed to allow a half-open recovery attempt.
   */
  isAvailable(providerName: string): boolean {
    const record = this.records.get(providerName);
    if (!record) return true;
    if (record.consecutiveFailures < this.config.unhealthyThreshold) return true;
    if (record.unhealthySince === undefined) return true;
    return Date.now() - record.unhealthySince >= this.config.recoveryAfterMs;
  }

  getStatus(providerName: string): AIProviderHealthStatus | undefined {
    const record = this.records.get(providerName);
    if (!record) return undefined;

    return {
      providerName,
      state: record.consecutiveFailures >= this.config.unhealthyThreshold ? 'unhealthy' : 'healthy',
      consecutiveFailures: record.consecutiveFailures,
      avgLatencyMs: record.latencies.length > 0
        ? record.latencies.reduce((sum, v) => sum + v, 0) / record.latencies.length
        : 0,
      lastCheckedAt: record.lastCheckedAt,
    };
  }

  private getOrCreate(providerName: string): ProviderHealthRecord {
    let record = this.records.get(providerName);
    if (!record) {
      record = { consecutiveFailures: 0, unhealthySince: undefined, latencies: [], lastCheckedAt: new Date() };
      this.records.set(providerName, record);
    }
    return record;
  }
}

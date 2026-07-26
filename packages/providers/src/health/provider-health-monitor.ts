import type { ProviderJob } from '../interfaces/provider-job.js';
import type { HealthState } from '../interfaces/provider-state.js';

export interface HealthMonitorConfig {
  readonly checkIntervalMs: number;
  readonly unhealthyThreshold: number;
  readonly degradedThresholdMs: number;
  readonly healthyThresholdMs: number;
}

export interface HealthCheckResult {
  readonly providerId: string;
  readonly healthy: boolean;
  readonly latencyMs: number;
  readonly state: HealthState;
  readonly checkedAt: Date;
  readonly error?: string;
}

export interface ProviderHealthStatus {
  readonly providerId: string;
  readonly state: HealthState;
  readonly lastCheck: Date;
  readonly consecutiveFailures: number;
  readonly avgLatencyMs: number;
}

export class ProviderHealthMonitor {
  private healthHistory = new Map<string, HealthCheckResult[]>();
  private status = new Map<string, ProviderHealthStatus>();

  constructor(private readonly config: HealthMonitorConfig) {}

  async checkProvider(provider: ProviderJob): Promise<HealthCheckResult> {
    const result = await provider.healthCheck();
    const checkResult: HealthCheckResult = {
      providerId: provider.info.id,
      healthy: result.healthy,
      latencyMs: result.latencyMs,
      state: this.determineState(result.latencyMs, result.healthy),
      checkedAt: new Date(),
      error: result.message,
    };

    this.recordCheck(checkResult);
    return checkResult;
  }

  async checkAll(providers: readonly ProviderJob[]): Promise<HealthCheckResult[]> {
    const results = await Promise.all(
      providers.map((p) => this.checkProvider(p)),
    );
    return results;
  }

  getStatus(providerId: string): ProviderHealthStatus | undefined {
    return this.status.get(providerId);
  }

  getAllStatuses(): ProviderHealthStatus[] {
    return Array.from(this.status.values());
  }

  getHistory(providerId: string, limit: number = 10): HealthCheckResult[] {
    const history = this.healthHistory.get(providerId) ?? [];
    return history.slice(-limit);
  }

  private recordCheck(result: HealthCheckResult): void {
    const history = this.healthHistory.get(result.providerId) ?? [];
    history.push(result);
    if (history.length > 100) {
      history.shift();
    }
    this.healthHistory.set(result.providerId, history);

    const consecutiveFailures = result.healthy ? 0 : this.getConsecutiveFailures(result.providerId) + 1;
    const avgLatency = this.calculateAvgLatency(result.providerId, result.latencyMs);

    this.status.set(result.providerId, {
      providerId: result.providerId,
      state: result.state,
      lastCheck: result.checkedAt,
      consecutiveFailures,
      avgLatencyMs: avgLatency,
    });
  }

  private determineState(latencyMs: number, healthy: boolean): HealthState {
    if (!healthy) return 'unhealthy';
    if (latencyMs > this.config.degradedThresholdMs) return 'degraded';
    return 'healthy';
  }

  private getConsecutiveFailures(providerId: string): number {
    const history = this.healthHistory.get(providerId) ?? [];
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i]?.healthy) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private calculateAvgLatency(providerId: string, newLatency: number): number {
    const history = this.healthHistory.get(providerId) ?? [];
    const recent = history.slice(-10);
    const total = recent.reduce((sum, h) => sum + h.latencyMs, newLatency);
    return total / (recent.length + 1);
  }
}

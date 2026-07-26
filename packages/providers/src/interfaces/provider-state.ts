// Provider state tracking for operational status

export type HealthState = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ProviderState {
  readonly providerId: string;
  readonly lastSync: Date | null;
  readonly nextSync: Date | null;
  readonly health: HealthState;
  readonly importedCount: number;
  readonly failedCount: number;
  readonly normalizedCount: number;
  readonly deduplicatedCount: number;
  readonly lastError: string | null;
  readonly lastErrorAt: Date | null;
  readonly consecutiveFailures: number;
  readonly consecutiveSuccesses: number;
  readonly avgResponseTimeMs: number;
  readonly totalRequests: number;
  readonly updatedAt: Date;
}

export interface ProviderStateUpdate {
  readonly providerId: string;
  readonly changes: Partial<Omit<ProviderState, 'providerId' | 'updatedAt'>>;
}

export function createInitialState(providerId: string): ProviderState {
  return {
    providerId,
    lastSync: null,
    nextSync: null,
    health: 'unknown',
    importedCount: 0,
    failedCount: 0,
    normalizedCount: 0,
    deduplicatedCount: 0,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    avgResponseTimeMs: 0,
    totalRequests: 0,
    updatedAt: new Date(),
  };
}

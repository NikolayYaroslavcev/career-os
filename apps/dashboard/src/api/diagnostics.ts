import { apiClient } from './client';

export type ProviderAuthStatus = 'not_required' | 'configured' | 'missing';
export type HealthState = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ProviderFetchDiagnostics {
  readonly at: string;
  readonly durationMs: number;
  readonly ok: boolean;
  readonly error?: string;
  readonly fetchedCount: number;
  readonly normalizedCount: number;
  readonly deduplicatedCount: number;
  readonly filteredCount: number;
  readonly persistedCount: number;
  readonly parseFailureCount: number;
}

export interface ProviderDiagnostics {
  readonly providerId: string;
  readonly registered: boolean;
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly authenticated: ProviderAuthStatus;
  readonly health: HealthState;
  readonly reason?: string;
  readonly lastFetch?: ProviderFetchDiagnostics;
}

export interface QueueJobCounts {
  readonly waiting: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly delayed: number;
}

export type VacancyExclusionReason =
  | 'duplicate'
  | 'provider_parse_failure'
  | 'low_relevance'
  | 'outside_top_n'
  | 'cache_hit'
  | 'ai_failed';

export interface VacancyExclusion {
  readonly vacancyId: string;
  readonly reason: VacancyExclusionReason;
  readonly stage: string;
}

export interface SearchRunStage {
  readonly name: string;
  readonly input: number;
  readonly output: number;
  readonly durationMs: number;
  readonly success: boolean;
}

export interface SearchRunTrace {
  readonly runId: string;
  readonly searchProfileId: string;
  readonly userId: string;
  readonly startedAt: string;
  readonly totalDurationMs: number;
  readonly aiEnabled: boolean;
  readonly awaitedAiMatching: boolean;
  readonly stages: readonly SearchRunStage[];
  readonly exclusions: readonly VacancyExclusion[];
}

export interface AiProviderDiagnostics {
  readonly name: string;
  readonly health: { readonly providerName: string; readonly state: string } | null;
}

export interface AiDiagnosticsMetrics {
  readonly cacheReused: number;
  readonly triageTotal: number;
  readonly triagePassed: number;
  readonly triageRejected: number;
  readonly failed: number;
  readonly evaluated: number;
  readonly avgBatchDurationMs: number;
}

export async function getProviderDiagnostics(): Promise<{ providers: ProviderDiagnostics[] }> {
  return apiClient('/api/v1/diagnostics/providers');
}

export async function getQueueDiagnostics(): Promise<{ queue: QueueJobCounts }> {
  return apiClient('/api/v1/diagnostics/queue');
}

export async function getSearchRunTraces(): Promise<{ runs: SearchRunTrace[] }> {
  return apiClient('/api/v1/diagnostics/runs');
}

export async function getAiDiagnostics(): Promise<{ providers: AiProviderDiagnostics[]; metrics: AiDiagnosticsMetrics }> {
  return apiClient('/api/v1/diagnostics/ai');
}

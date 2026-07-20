import type { HealthState } from './provider-state.js';

export type ProviderAuthStatus = 'not_required' | 'configured' | 'missing';

/**
 * Outcome of the most recent fetch attempt for a provider — one snapshot per
 * provider, overwritten on every search. Counts trace the pipeline stages a
 * vacancy from this provider passed through: fetched -> normalized ->
 * deduplicated (cross-provider) -> filtered (rule relevance) -> persisted.
 */
export interface ProviderFetchDiagnostics {
  readonly at: Date;
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

/**
 * A single provider's complete operational status: whether it's registered,
 * enabled, configured, and authenticated, plus its live health state and the
 * most recent fetch's pipeline counts. Unregistered/unconfigured providers
 * still get an entry (with `reason` explaining why) so nothing is silently
 * omitted from diagnostics.
 */
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

import type { HealthState } from './provider-state.js';

export type ProviderAuthStatus = 'not_required' | 'configured' | 'missing';

/**
 * User-facing operational status, distinct from the low-level
 * registered/configured/authenticated flags: READY means the provider is
 * usable right now, BLOCKED means it's fully configured but an external
 * factor (e.g. anti-bot protection) prevents it from working,
 * NEEDS_CONFIGURATION means it's simply missing required env vars.
 */
export type ProviderOperationalStatus = 'READY' | 'BLOCKED' | 'NEEDS_CONFIGURATION' | 'UNKNOWN';

/**
 * Whether this provider can be bulk-synced through the standard fetch
 * pipeline. Some providers (e.g. LinkedIn) are READY but only ingest data
 * through a different mechanism (a browser extension), so bulk sync isn't
 * applicable even though the provider itself works.
 */
export type BulkSyncStatus = 'SUPPORTED' | 'NOT_SUPPORTED_FOR_BULK_SYNC';

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
  /** User-facing status — see {@link ProviderOperationalStatus}. */
  readonly status: ProviderOperationalStatus;
  /** Human-readable explanation, set when status is BLOCKED or NEEDS_CONFIGURATION. */
  readonly statusReason?: string;
  /** Env vars this provider needs before it can be configured (e.g. ['GREENHOUSE_BOARD_TOKEN', 'GREENHOUSE_COMPANY_NAME']). */
  readonly requiredConfig?: readonly string[];
  /** Set when the provider ingests data through a non-bulk-sync mechanism, e.g. "Browser Extension ingestion". */
  readonly ingestionMode?: string;
  readonly bulkSyncStatus: BulkSyncStatus;
}

/**
 * ADR-035 Phase 1: CompanyWatch health/priority lifecycle. Deterministic, pure
 * functions only (mirrors packages/ai/src/extraction/message-extraction-confidence.ts's
 * convention: named/versioned constants, no I/O, same input -> same output).
 *
 * Health state machine mirrors VacancySource's ACTIVE/BROKEN failureCount model
 * (packages/career/src/domain/entities/vacancy-source.ts, ADR-030) and reuses
 * the same "3 consecutive failures" threshold SyncSchedulerService already
 * hardcodes (UNHEALTHY_AFTER_CONSECUTIVE_FAILURES) rather than picking a new
 * number:
 *
 *   ACTIVE/DEGRADED --sync success--------------------> ACTIVE (count reset to 0)
 *   ACTIVE          --sync failure (count 1-2)---------> DEGRADED
 *   ACTIVE/DEGRADED --structural failure (first time)--> DEGRADED (fast-tracked, ADR §8)
 *   DEGRADED        --sync failure (count >= 3)--------> BROKEN
 *   BROKEN          --sync success---------------------> ACTIVE (count reset)
 *   BROKEN          --continuously broken >= 14 days---> RETIRED (active=false)
 */
export type CompanyWatchHealthStatus = 'ACTIVE' | 'DEGRADED' | 'BROKEN' | 'RETIRED';

export const COMPANY_WATCH_UNHEALTHY_AFTER_CONSECUTIVE_FAILURES = 3;
export const COMPANY_WATCH_RETIREMENT_AFTER_BROKEN_MS = 14 * 24 * 60 * 60 * 1000;

// Polling-interval floor/ceiling mirror SyncSchedulerService.DEFAULT_SYNC_INTERVALS'
// busiest (1h) and quietest (hn_hiring, 24h) tiers rather than inventing new bounds.
export const COMPANY_WATCH_MIN_POLLING_INTERVAL_SECONDS = 60 * 60;
export const COMPANY_WATCH_MAX_POLLING_INTERVAL_SECONDS = 24 * 60 * 60;
export const COMPANY_WATCH_BROKEN_POLLING_INTERVAL_SECONDS = 6 * 60 * 60;

// 4-week trailing window for CompanyWatchEvent NEW_JOB velocity (ADR-035 §9).
export const COMPANY_WATCH_PRIORITY_TRAILING_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;

export const COMPANY_WATCH_HEALTH_MODEL_VERSION = 1;

export interface DeriveNextHealthStatusParams {
  readonly currentStatus: CompanyWatchHealthStatus;
  /** Consecutive-failure count *after* incrementing for the failure being processed. */
  readonly consecutiveFailureCount: number;
  /** true for a parse/shape error (adapter couldn't understand the response), false for AtsHttpError (transient). */
  readonly isStructuralFailure: boolean;
}

/**
 * Health transition on a sync failure. Call site is responsible for
 * incrementing consecutiveFailureCount first. Any failure at count 1-2 moves
 * to DEGRADED (ADR §7's base diagram); a structural failure (parse/shape
 * error — "won't self-heal" per ADR §8) reaches BROKEN after 2 consecutive
 * occurrences instead of waiting for the full 3 a transient AtsHttpError needs.
 */
export function deriveNextHealthStatus(params: DeriveNextHealthStatusParams): CompanyWatchHealthStatus {
  if (params.currentStatus === 'RETIRED') return 'RETIRED';

  const brokenThreshold = params.isStructuralFailure ? 2 : COMPANY_WATCH_UNHEALTHY_AFTER_CONSECUTIVE_FAILURES;
  if (params.consecutiveFailureCount >= brokenThreshold) {
    return 'BROKEN';
  }

  return 'DEGRADED';
}

/** Whether a BROKEN company has been continuously broken long enough to auto-retire (ADR §8). */
export function isRetirementDue(
  healthStatus: CompanyWatchHealthStatus,
  lastSuccessfulSyncAt: Date | undefined
): boolean {
  if (healthStatus !== 'BROKEN') return false;
  if (!lastSuccessfulSyncAt) return false;
  return Date.now() - lastSuccessfulSyncAt.getTime() >= COMPANY_WATCH_RETIREMENT_AFTER_BROKEN_MS;
}

/**
 * Deterministic priority score (0-100) from trailing-window NEW_JOB velocity.
 * A quiet-but-healthy company still gets a non-zero floor so it isn't starved
 * to the polling ceiling permanently on one quiet month.
 */
export function computePriorityScore(newJobsInTrailingWindow: number): number {
  if (newJobsInTrailingWindow <= 0) return 20;
  return Math.min(100, 20 + newJobsInTrailingWindow * 8);
}

/**
 * Priority-driven pollingInterval (ADR §9): higher priority -> shorter
 * interval, floored/ceilinged at the same tiers DEFAULT_SYNC_INTERVALS uses.
 * BROKEN rows use a fixed backed-off interval per ADR §8 independent of
 * priority; RETIRED rows are excluded from syncing entirely (active=false),
 * but still get a defined interval in case of manual re-activation.
 */
export function derivePollingIntervalSeconds(priorityScore: number, healthStatus: CompanyWatchHealthStatus): number {
  if (healthStatus === 'BROKEN') return COMPANY_WATCH_BROKEN_POLLING_INTERVAL_SECONDS;
  if (healthStatus === 'RETIRED') return COMPANY_WATCH_MAX_POLLING_INTERVAL_SECONDS;

  const clamped = Math.max(0, Math.min(100, priorityScore));
  const span = COMPANY_WATCH_MAX_POLLING_INTERVAL_SECONDS - COMPANY_WATCH_MIN_POLLING_INTERVAL_SECONDS;
  return Math.round(COMPANY_WATCH_MAX_POLLING_INTERVAL_SECONDS - (clamped / 100) * span);
}

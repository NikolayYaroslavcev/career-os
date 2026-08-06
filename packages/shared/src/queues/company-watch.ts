export const COMPANY_WATCH_QUEUE = 'company-watch';
export const COMPANY_WATCH_SYNC_JOB = 'company-watch-sync';

/**
 * ADR-035 Phase 0: the queue/job name above were declared but never produced or
 * consumed — every sync happened only via a manual POST /company-watch/:id/sync.
 * These names wire a real self-scheduling producer (apps/worker), mirroring the
 * follow-up-reminder queue's "one process both produces and consumes its own
 * repeatable sweep" shape rather than a per-request trigger.
 */
export const COMPANY_WATCH_SCHEDULER_QUEUE_NAME = 'company-watch-scheduler';
export const COMPANY_WATCH_SCHEDULER_JOB_NAME = 'sweep-due-companies';
export const COMPANY_WATCH_SCHEDULER_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Wire contract between the scheduler sweep (apps/worker, enqueues one job per
 * CompanyWatch row whose shouldSync() is true) and the COMPANY_WATCH_QUEUE
 * consumer (also apps/worker) — kept here so producer and consumer can't drift.
 */
export interface CompanyWatchSyncJob {
  readonly companyWatchId: string;
}

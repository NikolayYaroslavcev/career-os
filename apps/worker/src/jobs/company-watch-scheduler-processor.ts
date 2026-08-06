import type { Job, Queue } from 'bullmq';
import { CompanyWatch, type CompanyWatchRepository, type AtsType } from '@careeros/company-watch';
import { COMPANY_WATCH_SYNC_JOB, type CompanyWatchSyncJob } from '@careeros/shared';

export interface CompanyWatchSchedulerDeps {
  readonly companyWatchRepository: CompanyWatchRepository;
  readonly syncQueue: Queue<CompanyWatchSyncJob>;
}

export interface CompanyWatchSchedulerResult {
  readonly scanned: number;
  readonly enqueued: number;
}

/**
 * ADR-035 Phase 0: the sweep half of the "self-scheduling" pair (mirrors
 * follow-up-reminder's own repeatable-job producer/consumer split). Reuses
 * CompanyWatch.shouldSync() — previously unused, since CompanyWatchService
 * operated on the plain CompanyWatchData DTO — as the per-company due-check,
 * same gate the ADR calls out explicitly. jobId: company.id makes re-adding a
 * still-queued/active company a no-op (BullMQ dedupes by jobId within a
 * queue), so a slow sync can't be double-enqueued by the next tick.
 */
export async function sweepDueCompanies(deps: CompanyWatchSchedulerDeps): Promise<CompanyWatchSchedulerResult> {
  const active = await deps.companyWatchRepository.findAllActive();
  let enqueued = 0;

  for (const data of active) {
    const company = CompanyWatch.reconstitute({ ...data, atsType: data.atsType as AtsType });
    if (!company.shouldSync()) continue;

    await deps.syncQueue.add(
      COMPANY_WATCH_SYNC_JOB,
      { companyWatchId: company.id },
      { jobId: company.id, removeOnComplete: true, removeOnFail: true }
    );
    enqueued += 1;
  }

  return { scanned: active.length, enqueued };
}

export function createCompanyWatchSchedulerJobHandler(deps: CompanyWatchSchedulerDeps) {
  return async (_job: Job): Promise<CompanyWatchSchedulerResult> => sweepDueCompanies(deps);
}

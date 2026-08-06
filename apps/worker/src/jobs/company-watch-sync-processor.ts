import type { Job } from 'bullmq';
import type { CompanyWatchService, SyncResult } from '@careeros/company-watch';
import type { CompanyWatchSyncJob } from '@careeros/shared';

/**
 * ADR-035 Phase 0: the consumer half of COMPANY_WATCH_QUEUE, enqueued by
 * company-watch-scheduler-processor.ts. Delegates straight to the same
 * CompanyWatchService.syncCompany() the manual POST /company-watch/:id/sync
 * route already calls — no separate sync path to keep in sync.
 */
export function createCompanyWatchSyncJobHandler(companyWatchService: CompanyWatchService) {
  return async (job: Job<CompanyWatchSyncJob>): Promise<SyncResult> =>
    companyWatchService.syncCompany(job.data.companyWatchId);
}

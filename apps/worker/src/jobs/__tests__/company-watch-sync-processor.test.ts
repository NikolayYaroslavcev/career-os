import { describe, it, expect, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { CompanyWatchService, SyncResult } from '@careeros/company-watch';
import type { CompanyWatchSyncJob } from '@careeros/shared';
import { createCompanyWatchSyncJobHandler } from '../company-watch-sync-processor.js';

describe('createCompanyWatchSyncJobHandler', () => {
  it('delegates to CompanyWatchService.syncCompany with the job payload id', async () => {
    const result: SyncResult = {
      companyWatchId: 'company-1',
      jobsFound: 2,
      newJobs: 1,
      removedJobs: 0,
      changedJobs: 0,
      durationMs: 10,
      success: true,
    };
    const syncCompany = vi.fn().mockResolvedValue(result);
    const service = { syncCompany } as unknown as CompanyWatchService;

    const handler = createCompanyWatchSyncJobHandler(service);
    const job = { data: { companyWatchId: 'company-1' } } as Job<CompanyWatchSyncJob>;
    const outcome = await handler(job);

    expect(syncCompany).toHaveBeenCalledWith('company-1');
    expect(outcome).toEqual(result);
  });
});

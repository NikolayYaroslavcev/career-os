import { describe, it, expect, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { DiscoveryBulkIngestService, DiscoverySourceRunResult } from '@careeros/discovery-sources';
import type { DiscoverySourceRunJob } from '@careeros/shared';
import { createDiscoverySourceRunJobHandler } from '../discovery-source-run-processor.js';

describe('createDiscoverySourceRunJobHandler', () => {
  it('delegates to DiscoveryBulkIngestService.runSource with the job payload sourceId', async () => {
    const result: DiscoverySourceRunResult = {
      sourceId: 'cncf_landscape',
      skipped: false,
      found: 12,
      deduplicated: 3,
      enrolled: 1,
      rejected: 5,
      hasMore: false,
      durationMs: 42,
    };
    const runSource = vi.fn().mockResolvedValue(result);
    const ingestService = { runSource } as unknown as DiscoveryBulkIngestService;

    const handler = createDiscoverySourceRunJobHandler(ingestService);
    const job = { data: { sourceId: 'cncf_landscape' } } as Job<DiscoverySourceRunJob>;
    const outcome = await handler(job);

    expect(runSource).toHaveBeenCalledWith('cncf_landscape');
    expect(outcome).toEqual(result);
  });
});

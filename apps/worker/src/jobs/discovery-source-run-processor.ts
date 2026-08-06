import type { Job } from 'bullmq';
import type { DiscoveryBulkIngestService, DiscoverySourceRunResult } from '@careeros/discovery-sources';
import type { DiscoverySourceRunJob } from '@careeros/shared';

/**
 * ADR-035 Phase 4: the consumer half of DISCOVERY_SOURCE_RUN_QUEUE, enqueued
 * by discovery-source-scheduler-processor.ts. Delegates to
 * DiscoveryBulkIngestService.runSource() — the same orchestration a manual
 * "run this source now" trigger would use, no separate execution path.
 */
export function createDiscoverySourceRunJobHandler(ingestService: DiscoveryBulkIngestService) {
  return async (job: Job<DiscoverySourceRunJob>): Promise<DiscoverySourceRunResult> =>
    ingestService.runSource(job.data.sourceId as DiscoverySourceRunResult['sourceId']);
}

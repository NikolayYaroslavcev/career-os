import type { Job, Queue } from 'bullmq';
import type { DiscoverySourceConfigRepository } from '@careeros/discovery-sources';
import { DISCOVERY_SOURCE_RUN_JOB, DISCOVERY_SOURCE_DEFAULT_INTERVALS_MS, type DiscoverySourceRunJob } from '@careeros/shared';

export interface DiscoverySourceSchedulerDeps {
  readonly configRepository: DiscoverySourceConfigRepository;
  readonly runQueue: Queue<DiscoverySourceRunJob>;
}

export interface DiscoverySourceSchedulerResult {
  readonly scanned: number;
  readonly enqueued: number;
}

const DEFAULT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function isDue(lastRunAt: Date | null, intervalMs: number): boolean {
  if (!lastRunAt) return true;
  return Date.now() - lastRunAt.getTime() >= intervalMs;
}

/**
 * ADR-035 Phase 4: the scheduler half of the DiscoverySource run pair,
 * mirroring company-watch-scheduler-processor.ts's sweep/enqueue shape.
 * Each DiscoverySource has its own (much longer) cadence than the sweep
 * interval itself (ADR §1) — DISCOVERY_SOURCE_DEFAULT_INTERVALS_MS decides
 * whether a given source is actually due on this sweep.
 */
export async function sweepDueDiscoverySources(deps: DiscoverySourceSchedulerDeps): Promise<DiscoverySourceSchedulerResult> {
  const sources = await deps.configRepository.findAllEnabled();
  let enqueued = 0;

  for (const source of sources) {
    const intervalMs = DISCOVERY_SOURCE_DEFAULT_INTERVALS_MS[source.sourceId] ?? DEFAULT_INTERVAL_MS;
    if (!isDue(source.lastRunAt, intervalMs)) continue;

    await deps.runQueue.add(
      DISCOVERY_SOURCE_RUN_JOB,
      { sourceId: source.sourceId },
      { jobId: source.sourceId, removeOnComplete: true, removeOnFail: true }
    );
    enqueued += 1;
  }

  return { scanned: sources.length, enqueued };
}

export function createDiscoverySourceSchedulerJobHandler(deps: DiscoverySourceSchedulerDeps) {
  return async (_job: Job): Promise<DiscoverySourceSchedulerResult> => sweepDueDiscoverySources(deps);
}

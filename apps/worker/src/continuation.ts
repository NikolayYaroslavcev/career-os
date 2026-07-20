import type { Queue } from 'bullmq';
import {
  VACANCY_ANALYSIS_JOB_NAME,
  buildVacancyAnalysisJobId,
  type AiBatchBacklog,
  type VacancyAnalysisJob,
} from '@careeros/shared';

export interface ContinuationLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ContinuationDeps {
  readonly backlog: AiBatchBacklog;
  readonly queue: Pick<Queue<VacancyAnalysisJob>, 'addBulk'>;
  readonly batchSize: number;
  readonly logger: ContinuationLogger;
}

/**
 * Continuous background processing (EPIC-17 Part 6): pulls the next batch of
 * backlogged vacancy IDs for a search profile and enqueues them, one call per
 * completed job. Reuses the same `jobId` dedup convention as the initial
 * enqueue (apps/backend) so a vacancy can never be double-queued. A no-op
 * once the backlog for that search profile is empty — that's how the batch
 * chain terminates.
 */
export function createContinuationHandler(deps: ContinuationDeps) {
  return async function continueBatch(searchProfileId: string): Promise<void> {
    try {
      const nextVacancyIds = await deps.backlog.popBatch(searchProfileId, deps.batchSize);
      if (nextVacancyIds.length === 0) return;

      await deps.queue.addBulk(
        nextVacancyIds.map((vacancyId) => ({
          name: VACANCY_ANALYSIS_JOB_NAME,
          data: { vacancyId, searchProfileId },
          opts: { jobId: buildVacancyAnalysisJobId(searchProfileId, vacancyId) },
        }))
      );
      deps.logger.info('Continuation batch enqueued', { searchProfileId, count: nextVacancyIds.length });
    } catch (error) {
      deps.logger.error('Failed to enqueue continuation batch', {
        searchProfileId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

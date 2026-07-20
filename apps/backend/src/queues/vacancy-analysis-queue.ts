import { Queue } from 'bullmq';
import {
  VACANCY_ANALYSIS_QUEUE_NAME,
  VACANCY_ANALYSIS_JOB_NAME,
  buildVacancyAnalysisJobId,
  type VacancyAnalysisJob,
} from '@careeros/shared';

export type { VacancyAnalysisJob } from '@careeros/shared';

/**
 * Trigger port for the "AI Analysis" pipeline stage: called right after a
 * vacancy has been persisted and deterministically filtered for a search
 * profile, so analysis runs out-of-band in apps/worker instead of blocking
 * the /intelligence/search request (see ADR-026 — the request never awaits
 * AI). Enqueue failures (e.g. Redis down) are swallowed by the caller and
 * logged rather than failing the search response; affected vacancies simply
 * stay 'pending' until the queue recovers.
 */
export interface VacancyAnalysisQueue {
  enqueue(jobs: readonly VacancyAnalysisJob[]): Promise<void>;
}

export class BullMqVacancyAnalysisQueue implements VacancyAnalysisQueue {
  private readonly queue: Queue<VacancyAnalysisJob>;

  constructor(redisUrl: string) {
    this.queue = new Queue<VacancyAnalysisJob>(VACANCY_ANALYSIS_QUEUE_NAME, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
  }

  async enqueue(jobs: readonly VacancyAnalysisJob[]): Promise<void> {
    if (jobs.length === 0) return;

    await this.queue.addBulk(
      jobs.map((job) => ({
        name: VACANCY_ANALYSIS_JOB_NAME,
        data: job,
        opts: {
          jobId: buildVacancyAnalysisJobId(job.searchProfileId, job.vacancyId),
        },
      }))
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export class NoopVacancyAnalysisQueue implements VacancyAnalysisQueue {
  async enqueue(_jobs: readonly VacancyAnalysisJob[]): Promise<void> {
    // Intentionally does nothing — used when Redis isn't configured (e.g. tests).
  }
}

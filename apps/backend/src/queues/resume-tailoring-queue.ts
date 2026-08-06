import { Queue } from 'bullmq';
import {
  RESUME_TAILORING_QUEUE_NAME,
  RESUME_TAILORING_JOB_NAME,
  buildResumeTailoringJobId,
  type ResumeTailoringJob,
} from '@careeros/shared';

export type { ResumeTailoringJob } from '@careeros/shared';

/**
 * Trigger port for the resume-tailoring pipeline (ADR-031) — mirrors
 * apps/backend/src/queues/vacancy-analysis-queue.ts exactly. Enqueue
 * failures (e.g. Redis down) are swallowed by the caller and logged rather
 * than failing the request; the TailoredResume row simply stays QUEUED
 * until the queue recovers.
 */
export interface ResumeTailoringQueue {
  enqueue(job: ResumeTailoringJob): Promise<void>;
}

export class BullMqResumeTailoringQueue implements ResumeTailoringQueue {
  private readonly queue: Queue<ResumeTailoringJob>;

  constructor(redisUrl: string) {
    this.queue = new Queue<ResumeTailoringJob>(RESUME_TAILORING_QUEUE_NAME, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
  }

  async enqueue(job: ResumeTailoringJob): Promise<void> {
    await this.queue.add(RESUME_TAILORING_JOB_NAME, job, {
      jobId: buildResumeTailoringJobId(job.resumeId, job.vacancyId),
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export class NoopResumeTailoringQueue implements ResumeTailoringQueue {
  async enqueue(_job: ResumeTailoringJob): Promise<void> {
    // Intentionally does nothing — used when Redis isn't configured (e.g. tests).
  }
}

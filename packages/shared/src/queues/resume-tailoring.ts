export const RESUME_TAILORING_QUEUE_NAME = 'resume-tailoring';
export const RESUME_TAILORING_JOB_NAME = 'tailor-resume';

/**
 * Wire contract between the BullMQ producer (apps/backend, TailoringRequestService)
 * and the consumer (apps/worker, resume-tailoring-processor). Kept here — rather
 * than duplicated in each app — so the queue/job names and payload shape can't
 * drift apart, mirroring packages/shared/src/queues/vacancy-analysis.ts.
 */
export interface ResumeTailoringJob {
  readonly resumeId: string;
  readonly vacancyId: string;
  readonly userId: string;
  readonly applicationId?: string;
  /** Bypasses the completed-row/inputHash reuse check — wired to the "Regenerate" button. */
  readonly forceRegenerate?: boolean;
}

/**
 * One in-flight/pending job per (resume, vacancy) pair — matches the
 * TailoredResume.@@unique([resumeId, vacancyId]) idempotency key. BullMQ
 * rejects custom job IDs containing ':' (its own Redis key delimiter), so
 * join with '__' instead, same as buildVacancyAnalysisJobId.
 */
export function buildResumeTailoringJobId(resumeId: string, vacancyId: string): string {
  return `${resumeId}__${vacancyId}`;
}

export const VACANCY_ANALYSIS_QUEUE_NAME = 'vacancy-analysis';
export const VACANCY_ANALYSIS_JOB_NAME = 'analyze-vacancy';

/**
 * Wire contract between the BullMQ producer (apps/backend, right after a
 * vacancy is persisted and deterministically filtered for a search profile)
 * and the consumer (apps/worker). Kept here — rather than duplicated in each
 * app — so the queue/job names and payload shape can't drift apart.
 */
export interface VacancyAnalysisJob {
  readonly vacancyId: string;
  readonly searchProfileId: string;
}

/**
 * One in-flight/pending job per (vacancy, profile) pair is enough — used by
 * both the initial enqueue (apps/backend) and continuation batches
 * (apps/worker, see AiBatchBacklog) so the two producers can't drift apart on
 * format. BullMQ rejects custom job IDs containing ':' (its own Redis key
 * delimiter), so join with '__' instead.
 */
export function buildVacancyAnalysisJobId(searchProfileId: string, vacancyId: string): string {
  return `${searchProfileId}__${vacancyId}`;
}

import { createHash } from 'node:crypto';

export interface TailoringHashInput {
  readonly resumeId: string;
  readonly resumeUpdatedAt: Date;
  readonly vacancyId: string;
  readonly vacancyUpdatedAt: Date;
}

/**
 * Fingerprints the inputs that feed a tailoring run — mirrors
 * computeVacancyAnalysisInputHash (packages/ai/src/matching/vacancy-analysis-hash.ts):
 * hashing `updatedAt` timestamps rather than full content is enough since
 * any relevant mutation bumps `updatedAt`.
 */
export function computeTailoringInputHash(input: TailoringHashInput): string {
  const payload = JSON.stringify({
    resumeId: input.resumeId,
    resumeUpdatedAt: input.resumeUpdatedAt.toISOString(),
    vacancyId: input.vacancyId,
    vacancyUpdatedAt: input.vacancyUpdatedAt.toISOString(),
  });

  return createHash('sha256').update(payload).digest('hex');
}

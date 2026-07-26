import { createHash } from 'node:crypto';

export interface VacancyAnalysisHashInput {
  readonly vacancyId: string;
  readonly vacancyUpdatedAt: Date;
  readonly searchProfileId: string;
  readonly searchProfileUpdatedAt: Date;
  readonly resumeId?: string;
  readonly resumeUpdatedAt?: Date;
}

/**
 * Fingerprints the inputs that feed a vacancy analysis. Reusing `updatedAt`
 * timestamps (rather than hashing full entity content) is enough to detect
 * drift because every relevant entity bumps `updatedAt` on mutation, and it
 * also naturally invalidates a profile-only analysis once a resume becomes
 * available (resumeId flips from absent to present) without any extra logic.
 */
export function computeVacancyAnalysisInputHash(input: VacancyAnalysisHashInput): string {
  const payload = JSON.stringify({
    vacancyId: input.vacancyId,
    vacancyUpdatedAt: input.vacancyUpdatedAt.toISOString(),
    searchProfileId: input.searchProfileId,
    searchProfileUpdatedAt: input.searchProfileUpdatedAt.toISOString(),
    resumeId: input.resumeId ?? null,
    resumeUpdatedAt: input.resumeUpdatedAt?.toISOString() ?? null,
  });

  return createHash('sha256').update(payload).digest('hex');
}

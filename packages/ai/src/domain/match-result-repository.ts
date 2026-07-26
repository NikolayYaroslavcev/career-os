import type { MatchResult } from './match-result.js';

export interface MatchResultRepository {
  save(matchResult: MatchResult): Promise<void>;
  findById(id: string): Promise<MatchResult | null>;
  /** The canonical reuse/cache lookup: one analysis per (searchProfile, vacancy) pair. */
  findBySearchProfileIdAndVacancyId(
    searchProfileId: string,
    vacancyId: string,
  ): Promise<MatchResult | null>;
  findByUserId(userId: string): Promise<readonly MatchResult[]>;
  findBySearchProfileId(searchProfileId: string): Promise<readonly MatchResult[]>;
  findByVacancyIds(vacancyIds: readonly string[]): Promise<readonly MatchResult[]>;
}

import { normalizeForMatching, computeLevenshteinSimilarity } from '@careeros/shared';
import { CANDIDATE_DUPLICATE_SIMILARITY_THRESHOLD } from '../domain/discovery-confidence.js';

export interface NearestNameMatch {
  readonly name: string;
  readonly similarity: number;
}

/**
 * ADR-035 §5: reuses DeduplicationEngine's Levenshtein matcher (now shared via
 * @careeros/shared, see ADR §5's "extract shared utility" instruction) rather
 * than copying it. DeduplicationEngine itself isn't reused directly — it's
 * coupled to NormalizedVacancy (company+title matching for cross-provider
 * vacancy dedup), whereas candidate dedup is company-name-only against
 * CompanyWatch/CompanyCandidate names+aliases.
 */
export class CandidateDeduplicationService {
  /** Nearest known name by Levenshtein similarity, or null if `knownNames` is empty. */
  findNearestMatch(companyName: string, knownNames: readonly string[]): NearestNameMatch | null {
    const normalizedTarget = normalizeForMatching(companyName);
    let best: NearestNameMatch | null = null;

    for (const knownName of knownNames) {
      const similarity = computeLevenshteinSimilarity(normalizedTarget, normalizeForMatching(knownName));
      if (!best || similarity > best.similarity) {
        best = { name: knownName, similarity };
      }
    }

    return best;
  }

  /**
   * ADR §1: DUPLICATE short-circuits at intake, before fingerprinting or a
   * CompanyCandidate row ever exists — the cheapest possible rejection.
   */
  isDuplicate(companyName: string, knownNames: readonly string[]): boolean {
    const nearest = this.findNearestMatch(companyName, knownNames);
    return nearest !== null && nearest.similarity >= CANDIDATE_DUPLICATE_SIMILARITY_THRESHOLD;
  }
}

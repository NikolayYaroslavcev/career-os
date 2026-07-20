import type { Resume, Vacancy, ExperienceLevel, Location } from '@careeros/career';

export interface ScoredVacancyCandidate {
  readonly vacancy: Vacancy;
  readonly score: number;
}

export interface VacancyRankingContext {
  readonly resume: Resume;
  readonly searchProfileTechnologies?: readonly string[];
  readonly resumeText?: string;
  readonly desiredPositions?: readonly string[];
  readonly experienceLevel?: ExperienceLevel;
  readonly desiredLocations?: readonly Location[];
}

/**
 * Extension point for a future ranking stage between keyword ranking
 * (TriageMatchingService's calculateRelevanceScore, see relevance-filter.ts)
 * and the AI/LLM stage — e.g. embedding-based semantic similarity. Deliberately
 * async: a real implementation almost certainly calls an embeddings API.
 *
 * EPIC-17 defines this interface but does not implement or wire in a
 * semantic ranker (out of scope — see ADR-027). When one is built, it
 * composes at the single spot marked in TriageMatchingService.triage(),
 * re-scoring/re-ordering keyword-ranked candidates before the topN cut —
 * no changes needed to AiMatchingService, IntelligenceWorkflowService, or
 * the queue/worker.
 */
export interface VacancyRanker {
  rank(
    candidates: readonly ScoredVacancyCandidate[],
    context: VacancyRankingContext
  ): Promise<readonly ScoredVacancyCandidate[]>;
}

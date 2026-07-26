import type { Vacancy } from '@careeros/career';
import type { MatchResult, Recommendation as RecommendationLabel, AIMetricsCollector } from '@careeros/ai';

export interface Recommendation {
  /** Stable identifier for this recommendation, shared with the MatchResult it was derived from — usable as a foreign key (e.g. Application.matchResultId) and as an analytics dimension. */
  readonly matchResultId: string;
  readonly vacancy: Vacancy;
  readonly score: number;
  readonly confidence: number;
  readonly recommendation: RecommendationLabel;
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly requiredSkills: readonly string[];
  readonly missingSkills: readonly string[];
  readonly seniorityEstimation: string;
  readonly remotePolicy: string;
  readonly salaryObservations: string | null;
  readonly reasoning: string;
  /** When the underlying MatchResult was generated — lets Dashboard/CRM consumers show recommendation freshness without a second lookup. */
  readonly generatedAt: Date;
  /** Version of the matching/scoring logic, independent of the AI prompt version — enables comparing recommendation quality across algorithm revisions. */
  readonly matchingAlgorithmVersion: string;
}

export class RecommendationService {
  constructor(private readonly metrics: AIMetricsCollector) {}

  build(matchResults: readonly MatchResult[], vacancies: ReadonlyMap<string, Vacancy>): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const matchResult of matchResults) {
      const vacancy = vacancies.get(matchResult.vacancyId);
      if (!vacancy) continue;

      recommendations.push({
        matchResultId: matchResult.id,
        vacancy,
        score: matchResult.overallScore,
        confidence: matchResult.confidence,
        recommendation: matchResult.recommendation,
        summary: matchResult.summary,
        strengths: matchResult.strengths,
        weaknesses: matchResult.weaknesses,
        requiredSkills: matchResult.requiredSkills,
        missingSkills: matchResult.missingSkills,
        seniorityEstimation: matchResult.seniorityEstimation,
        remotePolicy: matchResult.remotePolicy,
        salaryObservations: matchResult.salaryObservations,
        reasoning: matchResult.reasoning,
        generatedAt: matchResult.generatedAt,
        matchingAlgorithmVersion: matchResult.matchingAlgorithmVersion,
      });
    }

    this.metrics.incrementCounter('careeros.recommendation.generated', recommendations.length);

    return this.sortByScore(recommendations);
  }

  sortByScore(recommendations: readonly Recommendation[]): Recommendation[] {
    return [...recommendations].sort((a, b) => b.score - a.score);
  }
}

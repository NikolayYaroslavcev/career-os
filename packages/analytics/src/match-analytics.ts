import type { MatchAnalytics, MatchCategoryAnalytics, DateRange } from './types.js';
import { median, pearsonCorrelation } from './stats-utils.js';

interface MatchResultRecord {
  readonly overallScore: number;
  readonly categoryScores: unknown;
  /**
   * Whether the application (if any) tied to this match result reached
   * interview stage or beyond. `undefined`/`null` when there is no
   * corresponding application yet — those results are excluded from the
   * correlation calculation rather than counted as "no".
   */
  readonly reachedInterview?: boolean | null;
}

function getScoreDistribution(scores: readonly number[]): readonly { range: string; count: number }[] {
  const ranges = [
    { min: 0, max: 20, label: '0-20' },
    { min: 20, max: 40, label: '20-40' },
    { min: 40, max: 60, label: '40-60' },
    { min: 60, max: 80, label: '60-80' },
    { min: 80, max: 100, label: '80-100' },
  ];

  return ranges.map((range) => ({
    range: range.label,
    count: scores.filter((s) => s >= range.min && s < range.max).length,
  }));
}

function parseCategoryScores(raw: unknown): readonly { category: string; label: string; value: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { category: string; label: string; value: number } =>
      typeof item === 'object' && item !== null &&
      typeof (item as Record<string, unknown>).category === 'string' &&
      typeof (item as Record<string, unknown>).value === 'number',
    );
}

export function computeMatchAnalytics(
  matchResults: readonly MatchResultRecord[],
  period: DateRange,
): MatchAnalytics {
  if (matchResults.length === 0) {
    return {
      avgOverallScore: 0,
      medianOverallScore: 0,
      categoryAverages: [],
      lowestCategories: [],
      highestCategories: [],
      scoreDistribution: [],
      correlationWithInterviewRate: 0,
      period,
    };
  }

  const overallScores = matchResults.map((m) => m.overallScore);
  const avgOverallScore = Math.round(
    overallScores.reduce((s, v) => s + v, 0) / overallScores.length,
  );
  const medianOverallScore = Math.round(median(overallScores));

  // Aggregate category scores
  const categoryMap = new Map<string, { values: number[]; label: string }>();
  for (const mr of matchResults) {
    const categories = parseCategoryScores(mr.categoryScores);
    for (const cat of categories) {
      const existing = categoryMap.get(cat.category);
      if (existing) {
        existing.values.push(cat.value);
      } else {
        categoryMap.set(cat.category, { values: [cat.value], label: cat.label });
      }
    }
  }

  const categoryAverages: MatchCategoryAnalytics[] = Array.from(categoryMap.entries()).map(
    ([category, data]) => ({
      category,
      label: data.label,
      avgScore: Math.round(data.values.reduce((s, v) => s + v, 0) / data.values.length),
      minScore: Math.min(...data.values),
      maxScore: Math.max(...data.values),
      distribution: getScoreDistribution(data.values),
    }),
  );

  const sortedCategories = [...categoryAverages].sort((a, b) => a.avgScore - b.avgScore);
  const lowestCategories = sortedCategories.slice(0, 3).map((c) => ({
    category: c.label,
    avgScore: c.avgScore,
  }));
  const highestCategories = sortedCategories.slice(-3).reverse().map((c) => ({
    category: c.label,
    avgScore: c.avgScore,
  }));

  const withOutcome = matchResults.filter(
    (m): m is MatchResultRecord & { reachedInterview: boolean } => typeof m.reachedInterview === 'boolean',
  );
  const correlationWithInterviewRate = withOutcome.length >= 2
    ? Math.round(
        pearsonCorrelation(
          withOutcome.map((m) => m.overallScore),
          withOutcome.map((m) => (m.reachedInterview ? 1 : 0)),
        ) * 100,
      ) / 100
    : 0;

  return {
    avgOverallScore,
    medianOverallScore,
    categoryAverages,
    lowestCategories,
    highestCategories,
    scoreDistribution: getScoreDistribution(overallScores),
    correlationWithInterviewRate,
    period,
  };
}

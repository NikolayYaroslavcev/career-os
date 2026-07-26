import { confidenceFor } from './success-pattern-analyzer.js';
import type {
  ResumeVersionSummary,
  ResumeVersionComparison,
  ResumeVersionMetricDelta,
  ResumeComparisonMetric,
  DateRange,
} from './types.js';

const COMPARABLE_METRICS: readonly ResumeComparisonMetric[] = [
  'interviewRate',
  'offerRate',
  'responseRate',
  'avgMatchScore',
];

/**
 * Diffs two already-computed ResumeVersionSummary objects — no rates are recomputed here,
 * only compared. Confidence reuses the same sample-size heuristic as success-pattern-analyzer,
 * gated by the weaker side's sample size (a comparison is only as reliable as its thinner side).
 */
export function compareResumeVersions(
  versionA: ResumeVersionSummary,
  versionB: ResumeVersionSummary,
  period: DateRange,
): ResumeVersionComparison {
  const metricDeltas: ResumeVersionMetricDelta[] = COMPARABLE_METRICS.map((metric) => {
    const a = versionA[metric];
    const b = versionB[metric];
    const deltaAbsolute = Math.round((b - a) * 100) / 100;
    const deltaPercentage = a !== 0 ? Math.round((deltaAbsolute / a) * 10000) / 100 : b > 0 ? 100 : 0;
    const winner: 'A' | 'B' | 'tie' = deltaAbsolute > 0 ? 'B' : deltaAbsolute < 0 ? 'A' : 'tie';
    return { metric, deltaAbsolute, deltaPercentage, winner };
  });

  const bWins = metricDeltas.filter((d) => d.winner === 'B').length;
  const aWins = metricDeltas.filter((d) => d.winner === 'A').length;
  const overallWinner: 'A' | 'B' | 'tie' = bWins > aWins ? 'B' : aWins > bWins ? 'A' : 'tie';

  const sampleSize = Math.min(versionA.sampleSize, versionB.sampleSize);

  return {
    versionA,
    versionB,
    metricDeltas,
    overallWinner,
    confidence: confidenceFor(sampleSize),
    period,
  };
}

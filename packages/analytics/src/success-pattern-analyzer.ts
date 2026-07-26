import type { SuccessPattern, PerformanceBreakdown, BreakdownSegment } from './types.js';

export const MIN_SAMPLE_SIZE = 3;

export function confidenceFor(sampleSize: number): SuccessPattern['confidence'] {
  if (sampleSize >= 15) return 'high';
  if (sampleSize >= 6) return 'medium';
  return 'low';
}

function averageExcluding(segments: readonly BreakdownSegment[], excludeLabel: string, metric: keyof BreakdownSegment): number {
  const others = segments.filter((s) => s.label !== excludeLabel);
  if (others.length === 0) return 0;
  const sum = others.reduce((s, seg) => s + (seg[metric] as number), 0);
  return Math.round((sum / others.length) * 100) / 100;
}

/**
 * Detects, per breakdown dimension, which segment performs best (by offer
 * rate, falling back to interview rate when no segment has any offers) and
 * how much better it does than the rest — a pure derivation of the already
 * computed PerformanceBreakdown segments, no extra I/O.
 */
export function analyzeSuccessPatterns(
  breakdowns: readonly PerformanceBreakdown[],
): readonly SuccessPattern[] {
  const patterns: SuccessPattern[] = [];

  for (const breakdown of breakdowns) {
    const eligible = breakdown.segments.filter((s) => s.count >= MIN_SAMPLE_SIZE);
    if (eligible.length < 2) continue;

    const hasOffers = eligible.some((s) => s.offerRate > 0);
    const metric: 'offerRate' | 'interviewRate' = hasOffers ? 'offerRate' : 'interviewRate';

    const sorted = [...eligible].sort((a, b) => b[metric] - a[metric]);
    const best = sorted[0];
    if (!best || best[metric] <= 0) continue;

    const comparison = averageExcluding(eligible, best.label, metric);
    if (best[metric] <= comparison) continue;

    patterns.push({
      dimension: breakdown.dimension,
      bestPerforming: best.label,
      metric,
      value: best[metric],
      comparison,
      sampleSize: best.count,
      confidence: confidenceFor(best.count),
      description: `${best.label} has a ${best[metric]}% ${metric === 'offerRate' ? 'offer' : 'interview'} rate for ${breakdown.dimension}, vs an average of ${comparison}% for other segments.`,
    });
  }

  return patterns.sort((a, b) => (b.value - b.comparison) - (a.value - a.comparison));
}

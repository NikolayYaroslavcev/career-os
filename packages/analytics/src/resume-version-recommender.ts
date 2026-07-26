import { confidenceFor, MIN_SAMPLE_SIZE } from './success-pattern-analyzer.js';
import type { PerformanceBreakdown, ResumeRecommendation, ResumeRecommendationReason } from './types.js';

export interface RecommendationVacancyInput {
  readonly vacancyId: string;
  readonly country: string | null;
  readonly source: string | null;
  readonly technologies: readonly string[];
}

export interface ResumeVersionCandidate {
  readonly resumeId: string;
  readonly applications: number;
  readonly interviewRate: number;
  readonly avgMatchScore: number;
  readonly offerRate: number;
  /** This version's own per-dimension breakdowns (country/provider/technology/etc.), pre-filtered to its applications. */
  readonly breakdowns: readonly PerformanceBreakdown[];
}

interface Signal {
  readonly rate: number;
  readonly count: number;
}

interface CandidateSignals {
  readonly interviewRate: number;
  readonly avgMatchScore: number;
  readonly offerRate: number;
  readonly country: number;
  readonly provider: number;
  readonly technology: number;
}

interface CandidateScore {
  readonly resumeId: string;
  readonly score: number;
  readonly minSampleCount: number;
  readonly signals: CandidateSignals;
}

function normalize(value: number): number {
  return Math.max(0, Math.min(1, value / 100));
}

/**
 * Looks up `label` in the candidate's pre-computed breakdown for `dimension`. Uses that
 * segment's interview rate only when it has enough evidence (MIN_SAMPLE_SIZE, the same
 * threshold as the rest of the analytics package); otherwise falls back to the version's
 * overall interview rate — evidence-based either way, never a guess.
 */
function segmentSignal(
  breakdowns: readonly PerformanceBreakdown[],
  dimension: string,
  label: string | null,
  fallback: Signal,
): Signal {
  if (!label) return fallback;
  const breakdown = breakdowns.find((b) => b.dimension === dimension);
  const segment = breakdown?.segments.find((s) => s.label === label);
  if (segment && segment.count >= MIN_SAMPLE_SIZE) {
    return { rate: segment.interviewRate, count: segment.count };
  }
  return fallback;
}

function technologySignal(
  breakdowns: readonly PerformanceBreakdown[],
  technologies: readonly string[],
  fallback: Signal,
): Signal {
  if (technologies.length === 0) return fallback;
  const signals = technologies.map((t) => segmentSignal(breakdowns, 'technology', t, fallback));
  const rate = signals.reduce((sum, s) => sum + s.rate, 0) / signals.length;
  const count = Math.min(...signals.map((s) => s.count));
  return { rate, count };
}

function scoreCandidate(vacancy: RecommendationVacancyInput, candidate: ResumeVersionCandidate): CandidateScore {
  const overall: Signal = { rate: candidate.interviewRate, count: candidate.applications };
  const country = segmentSignal(candidate.breakdowns, 'country', vacancy.country, overall);
  const provider = segmentSignal(candidate.breakdowns, 'provider', vacancy.source, overall);
  const technology = technologySignal(candidate.breakdowns, vacancy.technologies, overall);

  const signals: CandidateSignals = {
    interviewRate: candidate.interviewRate,
    avgMatchScore: candidate.avgMatchScore,
    offerRate: candidate.offerRate,
    country: country.rate,
    provider: provider.rate,
    technology: technology.rate,
  };

  const score =
    100 *
    (0.35 * normalize(signals.interviewRate) +
      0.2 * normalize(signals.avgMatchScore) +
      0.15 * normalize(signals.offerRate) +
      0.15 * normalize(signals.country) +
      0.1 * normalize(signals.provider) +
      0.05 * normalize(signals.technology));

  const minSampleCount = Math.min(candidate.applications, country.count, provider.count, technology.count);

  return { resumeId: candidate.resumeId, score: Math.round(score * 100) / 100, minSampleCount, signals };
}

function buildReasons(
  vacancy: RecommendationVacancyInput,
  winner: CandidateScore,
  others: readonly CandidateScore[],
): ResumeRecommendationReason[] {
  const factors: { factor: string; weight: number; key: keyof CandidateSignals }[] = [
    { factor: 'interviewRate', weight: 0.35, key: 'interviewRate' },
    { factor: 'avgMatchScore', weight: 0.2, key: 'avgMatchScore' },
    { factor: 'offerRate', weight: 0.15, key: 'offerRate' },
    { factor: `country:${vacancy.country ?? 'Unknown'}`, weight: 0.15, key: 'country' },
    { factor: `provider:${vacancy.source ?? 'Unknown'}`, weight: 0.1, key: 'provider' },
    { factor: 'technology', weight: 0.05, key: 'technology' },
  ];

  return factors.map(({ factor, weight, key }) => {
    const comparisonValues = others.map((o) => o.signals[key]);
    const comparisonValue =
      comparisonValues.length > 0
        ? Math.round((comparisonValues.reduce((sum, v) => sum + v, 0) / comparisonValues.length) * 100) / 100
        : 0;
    return { factor, resumeVersionValue: winner.signals[key], comparisonValue, weight };
  });
}

/**
 * Deterministic weighted score per candidate, computed entirely from evidence already
 * present in Parts 2-3 (overall rates + per-dimension breakdowns) — no new heuristics.
 * Returns recommendedResumeId: null when fewer than 2 versions have any applications,
 * rather than fabricating a pick from insufficient data.
 */
export function recommendResumeVersion(
  vacancy: RecommendationVacancyInput,
  candidates: readonly ResumeVersionCandidate[],
): ResumeRecommendation {
  const eligible = candidates.filter((c) => c.applications > 0);

  if (eligible.length < 2) {
    return {
      vacancyId: vacancy.vacancyId,
      recommendedResumeId: null,
      score: 0,
      reasons: [],
      alternatives: [],
      confidence: 'low',
    };
  }

  const scored = eligible.map((c) => scoreCandidate(vacancy, c));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const winner = sorted[0] as CandidateScore;
  const others = sorted.slice(1);

  return {
    vacancyId: vacancy.vacancyId,
    recommendedResumeId: winner.resumeId,
    score: winner.score,
    reasons: buildReasons(vacancy, winner, others),
    alternatives: others.map((s) => ({ resumeId: s.resumeId, score: s.score })),
    confidence: confidenceFor(winner.minSampleCount),
  };
}

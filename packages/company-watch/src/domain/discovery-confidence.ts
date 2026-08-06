import type { AtsType } from './value-objects/ats-type.js';
import type { CompanyCandidateStatus } from './entities/company-candidate.js';

/**
 * ADR-035 §2: deterministic, weighted-category rubric — same shape as
 * packages/ai/src/extraction/message-extraction-confidence.ts (named/versioned
 * constant, no I/O, no LLM, same input -> same output). Category *inputs*
 * (reachability, job-signal) require I/O to produce (HTTP probes), but that
 * I/O happens in CompanyDiscoveryIntakeService — this module only scores
 * already-observed evidence.
 */
export const DISCOVERY_CONFIDENCE_VERSION = 1;

/** Score bands (ADR §2): >=85 auto-enroll, 50-84 review, <50 reject. */
export const DISCOVERY_AUTO_ENROLL_THRESHOLD = 85;
export const DISCOVERY_REVIEW_THRESHOLD = 50;

/** ADR-035 Phase 3: minimum thresholds for auto-conversion from vacancy pipeline. */
export const VACANCY_PIPELINE_MIN_SEEN_COUNT = 3;
export const VACANCY_PIPELINE_MIN_VACANCY_COUNT = 2;
export const VACANCY_PIPELINE_AUTO_ENROLL_SCORE = 80;

/**
 * ADR §1's DUPLICATE short-circuit already keeps near-duplicates out of the
 * scoring pipeline entirely (CandidateDeduplicationService, run before a
 * CompanyCandidate row exists). This is a stricter, later threshold: how
 * close a *non-duplicate* candidate's name is to something already known,
 * for the confidence rubric's "dedup distance" category (ADR §2).
 */
export const CANDIDATE_DUPLICATE_SIMILARITY_THRESHOLD = 0.92;

/**
 * Fallback adapters have no per-site parsing guarantee (ADR-033 scoping) —
 * ADR-035 §4 says they never auto-enroll regardless of score.
 */
const NEVER_AUTO_ENROLL_ATS_TYPES: ReadonlySet<AtsType> = new Set(['CUSTOM_HTML', 'JSON_LD']);

/** A human explicitly supplied this exact URL (ADR §1's single-shot path) — the highest-trust source there is. */
export const SINGLE_SHOT_SOURCE_AUTHORITY_SCORE = 100;

export type AtsTypeCertainty = 'STRUCTURED_MATCH' | 'HEURISTIC_MATCH' | 'FALLBACK';

const ATS_TYPE_CERTAINTY_SCORE: Record<AtsTypeCertainty, number> = {
  STRUCTURED_MATCH: 100,
  HEURISTIC_MATCH: 60,
  FALLBACK: 20,
};

const CATEGORY_WEIGHTS = {
  atsTypeCertainty: 0.3,
  reachability: 0.15,
  jobSignal: 0.2,
  sourceAuthority: 0.1,
  dedupDistance: 0.05,
  vacancyPipeline: 0.2,
} as const;

export interface DiscoveryConfidenceInput {
  readonly atsTypeCertainty: AtsTypeCertainty;
  readonly reachable: boolean;
  readonly jobSignalFound: boolean;
  /** 0-100. Caller-supplied — see SINGLE_SHOT_SOURCE_AUTHORITY_SCORE for the only source Phase 2 has. */
  readonly sourceAuthorityScore: number;
  /** 0-1 (Levenshtein similarity, via @careeros/shared). 0 = nothing close among known companies. */
  readonly nearestKnownNameSimilarity: number;
  /** ADR-035 Phase 3: vacancy pipeline signals for confidence boost. */
  readonly vacancyPipelineSignals?: VacancyPipelineSignals;
}

export interface VacancyPipelineSignals {
  readonly seenCount: number;
  readonly vacancyCount: number;
  readonly providerCount: number;
  readonly hasCareerUrl: boolean;
}

export interface DiscoveryConfidenceResult {
  readonly score: number;
  readonly breakdown: {
    readonly atsTypeCertainty: number;
    readonly reachability: number;
    readonly jobSignal: number;
    readonly sourceAuthority: number;
    readonly dedupDistance: number;
    readonly vacancyPipeline: number;
  };
}

export interface FingerprintCertaintyInput {
  readonly atsType: AtsType | null;
  readonly apiEndpoint: string | null;
}

/**
 * Classifies CompanyDiscoveryService's fingerprint result into the ATS-type
 * certainty tier ADR §2 scores: a resolved apiEndpoint means the fingerprint
 * parsed a concrete board token/company slug (structured), a bare atsType
 * with no endpoint means only a string match fired (heuristic), and
 * CUSTOM_HTML/JSON_LD/no detection at all is the fallback floor.
 */
export function classifyAtsTypeCertainty(result: FingerprintCertaintyInput): AtsTypeCertainty {
  if (!result.atsType || result.atsType === 'CUSTOM_HTML' || result.atsType === 'JSON_LD') {
    return 'FALLBACK';
  }
  return result.apiEndpoint ? 'STRUCTURED_MATCH' : 'HEURISTIC_MATCH';
}

/**
 * Computes the 0-100 weighted confidence score from already-observed evidence.
 * Same (input) always produces the same score — no randomness, no I/O here.
 */
export function computeDiscoveryConfidence(input: DiscoveryConfidenceInput): DiscoveryConfidenceResult {
  const vp = input.vacancyPipelineSignals;
  const vacancyPipelineScore = vp
    ? computeVacancyPipelineScore(vp.seenCount, vp.vacancyCount, vp.providerCount, vp.hasCareerUrl)
    : 0;

  const breakdown = {
    atsTypeCertainty: ATS_TYPE_CERTAINTY_SCORE[input.atsTypeCertainty],
    reachability: input.reachable ? 100 : 0,
    jobSignal: input.jobSignalFound ? 100 : 0,
    sourceAuthority: Math.max(0, Math.min(100, input.sourceAuthorityScore)),
    dedupDistance: Math.round((1 - Math.max(0, Math.min(1, input.nearestKnownNameSimilarity))) * 100),
    vacancyPipeline: vacancyPipelineScore,
  };

  const score =
    breakdown.atsTypeCertainty * CATEGORY_WEIGHTS.atsTypeCertainty +
    breakdown.reachability * CATEGORY_WEIGHTS.reachability +
    breakdown.jobSignal * CATEGORY_WEIGHTS.jobSignal +
    breakdown.sourceAuthority * CATEGORY_WEIGHTS.sourceAuthority +
    breakdown.dedupDistance * CATEGORY_WEIGHTS.dedupDistance +
    breakdown.vacancyPipeline * CATEGORY_WEIGHTS.vacancyPipeline;

  return { score: Math.round(Math.max(0, Math.min(100, score))), breakdown };
}

/**
 * ADR-035 Phase 3: score vacancy pipeline signals.
 * - seenCount: repeated sightings boost confidence (cap at 5)
 * - vacancyCount: more vacancies = stronger signal (cap at 10)
 * - providerCount: multi-provider = independent confirmation (cap at 3)
 * - hasCareerUrl: known career page = ready for enrollment
 */
function computeVacancyPipelineScore(
  seenCount: number,
  vacancyCount: number,
  providerCount: number,
  hasCareerUrl: boolean,
): number {
  const seenScore = Math.min(seenCount, 5) * 15; // 0-75
  const vacancyScore = Math.min(vacancyCount, 10) * 2; // 0-20
  const providerScore = Math.min(providerCount, 3) * 10; // 0-30 (bonus for multi-provider)
  const urlScore = hasCareerUrl ? 25 : 0; // 0-25

  return Math.min(100, seenScore + vacancyScore + providerScore + urlScore);
}

/**
 * Routes a scored candidate to its lifecycle status (ADR §4): score bands
 * decide AUTO_APPROVED/REVIEW_REQUIRED/REJECTED, then the never-auto-enroll
 * ATS types (fallback adapters, no per-site parsing guarantee) downgrade an
 * AUTO_APPROVED verdict to REVIEW_REQUIRED regardless of score.
 */
export function deriveCandidateStatusFromScore(score: number, atsType: AtsType | undefined): CompanyCandidateStatus {
  if (score < DISCOVERY_REVIEW_THRESHOLD) return 'REJECTED';
  if (score < DISCOVERY_AUTO_ENROLL_THRESHOLD) return 'REVIEW_REQUIRED';
  if (!atsType || NEVER_AUTO_ENROLL_ATS_TYPES.has(atsType)) return 'REVIEW_REQUIRED';
  return 'AUTO_APPROVED';
}

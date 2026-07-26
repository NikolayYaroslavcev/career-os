import type { Recommendation } from './recommendation.js';
import type { TokenUsage } from './ai-types.js';
import type { CategoryScore, ActionableItem, MatchExplanation } from './match-category.js';

export interface FitAssessment {
  readonly score: number;
  readonly confidence: number;
  readonly reasoning: string;
}

export interface MatchResult {
  readonly id: string;
  /** The search profile this analysis was generated for — the primary reuse/lookup key alongside vacancyId. */
  readonly searchProfileId: string;
  /** Set once resume-aware matching ran; absent for profile-only analyses (e.g. the async pre-warm pipeline before a resume exists). */
  readonly resumeId?: string;
  readonly vacancyId: string;
  readonly userId: string;
  readonly overallScore: number;
  readonly confidence: number;
  readonly recommendation: Recommendation;
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly requiredSkills: readonly string[];
  readonly missingSkills: readonly string[];
  readonly seniorityEstimation: string;
  readonly remotePolicy: string;
  readonly salaryObservations: string | null;
  readonly salaryFit: FitAssessment;
  readonly locationFit: FitAssessment;
  readonly experienceFit: FitAssessment;
  readonly careerGrowthFit: FitAssessment;
  readonly reasoning: string;
  readonly categoryScores: readonly CategoryScore[];
  readonly actionableItems: readonly ActionableItem[];
  readonly explanation: MatchExplanation | null;
  readonly generatedAt: Date;
  readonly model: string;
  readonly provider: string;
  readonly promptVersion: string;
  readonly promptId: string;
  /** Version of the matching/scoring logic that produced this result, independent of `promptVersion`. */
  readonly matchingAlgorithmVersion: string;
  /** Hash of the vacancy/profile/resume inputs used to generate this result — a mismatch against freshly-computed inputs means the vacancy or profile changed and analysis must be redone. */
  readonly inputHash: string;
  readonly tokenUsage: TokenUsage;
  readonly latencyMs: number;
  readonly estimatedCostUsd: number;
}

export interface MatchResultInput {
  readonly id?: string;
  readonly searchProfileId: string;
  readonly resumeId?: string;
  readonly vacancyId: string;
  readonly userId: string;
  readonly overallScore: number;
  readonly confidence: number;
  readonly recommendation: Recommendation;
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly requiredSkills: readonly string[];
  readonly missingSkills: readonly string[];
  readonly seniorityEstimation: string;
  readonly remotePolicy: string;
  readonly salaryObservations: string | null;
  readonly salaryFit: FitAssessment;
  readonly locationFit: FitAssessment;
  readonly experienceFit: FitAssessment;
  readonly careerGrowthFit: FitAssessment;
  readonly reasoning: string;
  readonly categoryScores?: readonly CategoryScore[];
  readonly actionableItems?: readonly ActionableItem[];
  readonly explanation?: MatchExplanation | null;
  readonly model: string;
  readonly provider: string;
  readonly promptVersion: string;
  readonly promptId: string;
  readonly matchingAlgorithmVersion: string;
  readonly inputHash: string;
  readonly tokenUsage: TokenUsage;
  readonly latencyMs: number;
  readonly estimatedCostUsd: number;
}

export function createMatchResult(input: MatchResultInput): MatchResult {
  return {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    categoryScores: input.categoryScores ?? [],
    actionableItems: input.actionableItems ?? [],
    explanation: input.explanation ?? null,
    generatedAt: new Date(),
  };
}

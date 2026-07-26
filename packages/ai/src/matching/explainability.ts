import type { CategoryScore, MatchCategory } from '../domain/match-category.js';
import type { MatchResult } from '../domain/match-result.js';

export interface ExplainabilityFactor {
  readonly category: 'skill' | 'experience' | 'salary' | 'location' | 'growth' | 'culture';
  readonly label: string;
  readonly impact: number;
  readonly explanation: string;
  readonly matched: boolean;
}

export interface ExplainabilityReport {
  readonly factors: readonly ExplainabilityFactor[];
  readonly overallReasoning: string;
  readonly confidence: number;
  readonly keyDecisionPoints: readonly string[];
}

const CATEGORY_TO_EXPLAINABILITY: Record<MatchCategory, ExplainabilityFactor['category']> = {
  technical_skills: 'skill',
  experience: 'experience',
  seniority: 'experience',
  domain_knowledge: 'skill',
  language: 'skill',
  location: 'location',
  salary: 'salary',
  remote_preference: 'location',
  culture_fit: 'culture',
  career_growth: 'growth',
};

export function categoryScoreToExplainabilityFactor(score: CategoryScore): ExplainabilityFactor {
  return {
    category: CATEGORY_TO_EXPLAINABILITY[score.category] ?? 'skill',
    label: score.label,
    impact: score.value - 50,
    explanation: score.explanation,
    matched: score.value >= 60,
  };
}

export function buildExplainabilityReport(matchResult: MatchResult): ExplainabilityReport {
  const factors = matchResult.categoryScores.map(categoryScoreToExplainabilityFactor);
  const ranked = rankFactorsByImpact(factors);
  const keyDecisionPoints = ranked
    .filter((f) => Math.abs(f.impact) >= 20)
    .map((f) => `${f.matched ? '+' : '-'} ${f.label}: ${f.explanation}`);

  return {
    factors: ranked,
    overallReasoning: matchResult.reasoning,
    confidence: matchResult.confidence,
    keyDecisionPoints,
  };
}

export function rankFactorsByImpact(factors: readonly ExplainabilityFactor[]): readonly ExplainabilityFactor[] {
  return [...factors].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

export function getPositiveFactors(factors: readonly ExplainabilityFactor[]): readonly ExplainabilityFactor[] {
  return factors.filter((f) => f.matched && f.impact > 0);
}

export function getNegativeFactors(factors: readonly ExplainabilityFactor[]): readonly ExplainabilityFactor[] {
  return factors.filter((f) => !f.matched || f.impact < 0);
}

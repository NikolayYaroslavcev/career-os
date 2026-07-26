import { apiClient } from './client';

export interface CategoryScore {
  readonly category: string;
  readonly label: string;
  readonly value: number;
  readonly weight: number;
  readonly confidence: number;
  readonly explanation: string;
}

export interface ActionableItem {
  readonly type: 'add_skill' | 'mention_keyword' | 'gain_experience' | 'adjust_expectation';
  readonly title: string;
  readonly description: string;
  readonly impact: number;
  readonly category: string;
  readonly priority: 'high' | 'medium' | 'low';
}

export interface ExplanationItem {
  readonly label: string;
  readonly detail: string;
}

export interface MatchExplanation {
  readonly overallPercent: number;
  readonly strengths: ExplanationItem[];
  readonly weaknesses: ExplanationItem[];
  readonly missingKeywords: string[];
  readonly categoryScores: CategoryScore[];
}

export interface ExplanationResponse {
  matchResultId: string;
  explanation: MatchExplanation | null;
  categoryScores: CategoryScore[];
}

export interface ActionableItemsResponse {
  matchResultId: string;
  actionableItems: ActionableItem[];
}

export async function getMatchExplanation(matchResultId: string): Promise<ExplanationResponse> {
  return apiClient<ExplanationResponse>(`/api/v1/match-results/${matchResultId}/explanation`);
}

export async function getActionableItems(matchResultId: string): Promise<ActionableItemsResponse> {
  return apiClient<ActionableItemsResponse>(`/api/v1/match-results/${matchResultId}/actionable-items`);
}

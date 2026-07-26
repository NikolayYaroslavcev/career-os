export const Recommendation = {
  STRONG_APPLY: 'StrongApply',
  APPLY: 'Apply',
  MAYBE: 'Maybe',
  SKIP: 'Skip',
} as const;

export type Recommendation = (typeof Recommendation)[keyof typeof Recommendation];

export const RECOMMENDATION_PRIORITY: Record<Recommendation, number> = {
  [Recommendation.STRONG_APPLY]: 4,
  [Recommendation.APPLY]: 3,
  [Recommendation.MAYBE]: 2,
  [Recommendation.SKIP]: 1,
};

export function compareRecommendations(a: Recommendation, b: Recommendation): number {
  return RECOMMENDATION_PRIORITY[b] - RECOMMENDATION_PRIORITY[a];
}

import { apiClient } from './client';

export interface RecommendedVacancy {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  remote: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  technologies: string[];
  publishedAt: string | null;
}

export type VacancyTier = 'HOT' | 'WARM' | 'COLD' | 'REJECT';

export interface RankingExplanation {
  score: number;
  tier: VacancyTier;
  positiveFactors: string[];
  warnings: string[];
}

export interface Recommendation {
  vacancy: RecommendedVacancy;
  score: number;
  tier: VacancyTier;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  qualityScore: number;
  explanation: RankingExplanation;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetRecommendationsParams {
  limit?: number;
  offset?: number;
  sortBy?: 'score' | 'newest' | 'salary';
}

export async function getRecommendations(
  params: GetRecommendationsParams = {},
): Promise<RecommendationsResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);

  const query = searchParams.toString();
  const endpoint = `/api/v1/recommendations${query ? `?${query}` : ''}`;

  return apiClient(endpoint);
}

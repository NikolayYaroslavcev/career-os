import { apiClient } from './client';

export interface VacancySummary {
  id: string;
  title: string;
  companyId: string;
  source: string | null;
  sourceUrl: string | null;
  applyUrl: string | null;
  location: string;
  remote: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  publishedAt: string | null;
}

export interface Recommendation {
  matchResultId: string;
  vacancy: VacancySummary;
  score: number;
  confidence: string;
  recommendation: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  requiredSkills: string[];
  missingSkills: string[];
  seniorityEstimation: string;
  remotePolicy: string;
  salaryObservations: string | null;
  reasoning: string;
  generatedAt: string;
  matchingAlgorithmVersion: string;
}

/**
 * 'matched': has a score. 'pending': queued for background AI analysis — poll
 * /status for it. 'skipped': will never be scored for this snapshot
 * (triage-rejected, or AI disabled) — don't poll it.
 */
export type VacancyMatchStatus = 'matched' | 'pending' | 'skipped';

export interface SearchVacancyResult {
  status: VacancyMatchStatus;
  vacancy: VacancySummary;
  recommendation: Recommendation | null;
}

export interface SearchResponse {
  searchProfileId: string;
  vacancies: SearchVacancyResult[];
  stats: {
    totalVacancies: number;
    matchedVacancies: number;
    pendingVacancies: number;
    averageScore: number;
  };
  aiEnabled: boolean;
}

export interface SearchError {
  error: {
    code: string;
    message: string;
    aiErrorType?: string;
  };
}

export interface RunSearchInput {
  searchProfileId?: string;
  providerId?: string;
}

export async function runSearch(data: RunSearchInput = {}): Promise<SearchResponse> {
  return apiClient('/api/v1/intelligence/search', {
    method: 'POST',
    body: data,
  });
}

export interface MatchStatusEntry {
  vacancyId: string;
  status: VacancyMatchStatus;
  recommendation: Recommendation | null;
}

export interface MatchStatusResponse {
  vacancies: MatchStatusEntry[];
}

export async function pollMatchStatus(searchProfileId: string, vacancyIds: string[]): Promise<MatchStatusResponse> {
  return apiClient('/api/v1/intelligence/status', {
    method: 'POST',
    body: { searchProfileId, vacancyIds },
  });
}

import { apiClient } from './client';

export interface SyncStatus {
  providerId: string;
  lastSyncAt: string | null;
  lastSyncResult: 'success' | 'failed' | 'pending';
  nextSyncAt: string | null;
  totalJobsSynced: number;
  lastError?: string;
}

export interface SyncAllResult {
  results: Array<{
    providerId: string;
    status: 'success' | 'failed';
    jobsSynced: number;
    error?: string;
    durationMs: number;
  }>;
  totalDurationMs: number;
}

export interface VacancyStats {
  totalJobs: number;
  newToday: number;
  providers: Array<{ source: string; count: number }>;
  totalProviders: number;
  lastSyncAt: string | null;
}

export interface VacancyListParams {
  query?: string;
  location?: string;
  remote?: string;
  salaryMin?: number;
  salaryMax?: number;
  company?: string;
  source?: string;
  experienceLevel?: string;
  employmentType?: string;
  technology?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  sortBy?: string;
  sortOrder?: string;
  limit?: number;
  offset?: number;
}

export interface VacancySourceInfo {
  id: string;
  providerId: string;
  providerType: string;
  sourceUrl: string | null;
  isPrimary: boolean;
  discoveredAt: string;
}

export interface VacancySummary {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  remote: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  url: string | null;
  applyUrl: string | null;
  source: string | null;
  sources: VacancySourceInfo[];
  publishedAt: string | null;
  fetchedAt: string;
  technologies: string[];
}

export interface VacancyListResponse {
  vacancies: VacancySummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface VacancyDetail extends Omit<VacancySummary, 'company' | 'sources'> {
  description: string;
  requirements: string[];
  experienceLevel: string;
  company: { id: string; name: string; website: string | null } | null;
  sources: (VacancySourceInfo & { lastSeenAt: string })[];
}

// Dashboard home renders several independent widgets that each want these
// stats on mount (see onboarding-checklist.tsx) — without this, they'd fire
// one identical request apiece instead of sharing the single one in flight.
let vacancyStatsInFlight: Promise<VacancyStats> | null = null;

export async function getVacancyStats(): Promise<VacancyStats> {
  if (vacancyStatsInFlight) return vacancyStatsInFlight;

  vacancyStatsInFlight = apiClient<VacancyStats>('/api/v1/vacancies/stats').finally(() => {
    vacancyStatsInFlight = null;
  });
  return vacancyStatsInFlight;
}

export async function listVacancies(params: VacancyListParams = {}, signal?: AbortSignal): Promise<VacancyListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return apiClient(`/api/v1/vacancies${qs ? `?${qs}` : ''}`, { signal });
}

export async function searchVacancies(params: VacancyListParams): Promise<VacancyListResponse> {
  return apiClient('/api/v1/vacancies/search', { method: 'POST', body: params });
}

export async function getVacancyDetail(id: string): Promise<VacancyDetail> {
  return apiClient(`/api/v1/vacancies/${id}`);
}

export async function getSyncStatuses(): Promise<{ statuses: SyncStatus[] }> {
  return apiClient('/api/v1/sync/status');
}

export async function syncAllProviders(): Promise<SyncAllResult> {
  return apiClient('/api/v1/sync/all', { method: 'POST' });
}

export async function syncProvider(providerId: string): Promise<{ status: string; jobsSynced: number; error?: string; durationMs: number }> {
  return apiClient(`/api/v1/sync/${providerId}`, { method: 'POST' });
}

export async function recordVacancyView(vacancyId: string): Promise<void> {
  await apiClient(`/api/v1/vacancies/${vacancyId}/view`, { method: 'POST' });
}

export async function recordVacancySave(vacancyId: string): Promise<void> {
  await apiClient(`/api/v1/vacancies/${vacancyId}/save`, { method: 'POST' });
}

export async function recordVacancyHide(vacancyId: string): Promise<void> {
  await apiClient(`/api/v1/vacancies/${vacancyId}/hide`, { method: 'POST' });
}

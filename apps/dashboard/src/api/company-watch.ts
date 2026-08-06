import { apiClient } from './client';

export interface CompanyWatch {
  id: string;
  name: string;
  aliases: string[];
  country?: string;
  languages: string[];
  tags: string[];
  atsType: string;
  careerUrl: string;
  atsEndpoint?: string;
  pollingInterval: number;
  active: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastSyncError?: string;
  metadata?: Record<string, unknown>;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  consecutiveFailureCount: number;
  healthStatus: 'ACTIVE' | 'DEGRADED' | 'BROKEN' | 'RETIRED';
  priorityScore: number;
  lastSuccessfulSyncAt?: string;
}

export interface CompanyWatchEvent {
  id: string;
  type: 'NEW_JOB' | 'REMOVED_JOB' | 'CHANGED_JOB';
  externalId?: string;
  title?: string;
  description?: string;
  url?: string;
  location?: string;
  salary?: { min?: number; max?: number; currency?: string };
  technologies: string[];
  publishedAt?: string;
  detectedAt: string;
  processed: boolean;
  notifiedAt?: string;
  companyWatchId: string;
}

export interface DiscoveryResult {
  atsType: string | null;
  careerUrl: string | null;
  apiEndpoint: string | null;
  jsonLd: unknown[];
  rss: string | null;
  sitemap: string | null;
  metadata: Record<string, unknown>;
}

export interface SyncResult {
  companyWatchId: string;
  jobsFound: number;
  newJobs: number;
  removedJobs: number;
  changedJobs: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export async function getWatchedCompanies(): Promise<CompanyWatch[]> {
  return apiClient('/api/v1/company-watch');
}

export async function getWatchedCompany(id: string): Promise<CompanyWatch> {
  return apiClient(`/api/v1/company-watch/${id}`);
}

export async function addWatchedCompany(data: Partial<CompanyWatch>): Promise<CompanyWatch> {
  return apiClient('/api/v1/company-watch', { method: 'POST', body: data });
}

export async function updateWatchedCompany(id: string, data: Partial<CompanyWatch>): Promise<CompanyWatch> {
  return apiClient(`/api/v1/company-watch/${id}`, { method: 'PUT', body: data });
}

export async function removeWatchedCompany(id: string): Promise<void> {
  return apiClient(`/api/v1/company-watch/${id}`, { method: 'DELETE' });
}

export async function syncCompany(id: string): Promise<SyncResult> {
  return apiClient(`/api/v1/company-watch/${id}/sync`, { method: 'POST' });
}

export async function getCompanyEvents(
  id: string,
  options?: { type?: string; limit?: number; offset?: number }
): Promise<CompanyWatchEvent[]> {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return apiClient(`/api/v1/company-watch/${id}/events${query ? `?${query}` : ''}`);
}

export async function discoverCompany(url: string): Promise<DiscoveryResult> {
  return apiClient('/api/v1/company-watch/discover', { method: 'POST', body: { url } });
}

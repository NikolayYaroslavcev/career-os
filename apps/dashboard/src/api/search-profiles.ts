import { apiClient } from './client';

export interface SearchProfile {
  id: string;
  userId: string;
  name: string;
  desiredPositions: string[];
  desiredTechnologies: string[];
  experienceLevel: string;
  desiredSalary: {
    min: number;
    max: number;
    currency: string;
    period: string;
  } | null;
  desiredLocations: {
    city: string | null;
    country: string | null;
    workMode: string;
    isRelocationPossible: boolean;
  }[];
  isRemoteOnly: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSearchProfileInput {
  name: string;
  desiredPositions?: string[];
  desiredTechnologies?: string[];
  experienceLevel: string;
  desiredSalary?: {
    min: number;
    max: number;
    currency: string;
    period: string;
  };
  desiredLocations?: {
    city?: string;
    country?: string;
    workMode: string;
    isRelocationPossible?: boolean;
  }[];
  isRemoteOnly?: boolean;
}

export type UpdateSearchProfileInput = Partial<CreateSearchProfileInput>;

// Dashboard home renders several independent widgets that each want the
// search profile list on mount (see onboarding-checklist.tsx, search-profile-widget.tsx)
// — without this, they'd fire one identical request apiece instead of sharing
// the single one in flight.
let listSearchProfilesInFlight: Promise<{ searchProfiles: SearchProfile[] }> | null = null;

export async function listSearchProfiles(): Promise<{ searchProfiles: SearchProfile[] }> {
  if (listSearchProfilesInFlight) return listSearchProfilesInFlight;

  listSearchProfilesInFlight = apiClient<{ searchProfiles: SearchProfile[] }>('/api/v1/search-profiles').finally(() => {
    listSearchProfilesInFlight = null;
  });
  return listSearchProfilesInFlight;
}

export async function getSearchProfile(id: string): Promise<SearchProfile> {
  return apiClient(`/api/v1/search-profiles/${id}`);
}

export async function createSearchProfile(data: CreateSearchProfileInput): Promise<SearchProfile> {
  return apiClient('/api/v1/search-profiles', {
    method: 'POST',
    body: data,
  });
}

export async function updateSearchProfile(
  id: string,
  data: UpdateSearchProfileInput
): Promise<SearchProfile> {
  return apiClient(`/api/v1/search-profiles/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export async function enableSearchProfile(id: string): Promise<SearchProfile> {
  return apiClient(`/api/v1/search-profiles/${id}/enable`, {
    method: 'POST',
  });
}

export async function disableSearchProfile(id: string): Promise<SearchProfile> {
  return apiClient(`/api/v1/search-profiles/${id}/disable`, {
    method: 'POST',
  });
}

export async function deleteSearchProfile(id: string): Promise<void> {
  await apiClient(`/api/v1/search-profiles/${id}`, {
    method: 'DELETE',
  });
}

import { apiClient, ApiError } from './client';
import { translate } from '@/lib/i18n/translate';

export interface Resume {
  id: string;
  title: string;
  summary: string;
  skills: string[];
  technologies: string[];
  format: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResumeResponse {
  id: string;
  title: string;
  format: string;
  extractedTextLength: number;
  createdAt: string;
}

export interface ListResumesResponse {
  resumes: Resume[];
  total: number;
}

export interface SearchProfileSuggestion {
  desiredPositions: string[];
  technologies: string[];
  experienceLevel: string;
  remotePreference: 'remote' | 'hybrid' | 'onsite' | null;
  confidence: number;
  reasoning: string;
}

// Dashboard home renders several independent widgets that each want the
// resume list on mount (see onboarding-checklist.tsx, resume-status-widget.tsx)
// — without this, they'd fire one identical request apiece instead of sharing
// the single one in flight.
let listResumesInFlight: Promise<ListResumesResponse> | null = null;

export async function listResumes(): Promise<ListResumesResponse> {
  if (listResumesInFlight) return listResumesInFlight;

  listResumesInFlight = apiClient<ListResumesResponse>('/api/v1/resumes').finally(() => {
    listResumesInFlight = null;
  });
  return listResumesInFlight;
}

export async function uploadResume(file: File): Promise<UploadResumeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient<UploadResumeResponse>('/api/v1/resumes', {
    method: 'POST',
    body: formData,
  });
}

export async function getSearchProfileSuggestion(resumeId: string): Promise<SearchProfileSuggestion> {
  try {
    return await apiClient<SearchProfileSuggestion>(`/api/v1/resumes/${resumeId}/search-profile-suggestion`, {
      method: 'POST',
    });
  } catch (err) {
    // The backend returns this specific code when no AI provider is configured/reachable —
    // worth a friendlier, translated message since it's a known/expected state, not a bug.
    if (err instanceof ApiError && (err.data as { error?: { code?: string } })?.error?.code === 'SERVICE_UNAVAILABLE') {
      throw new Error(translate('resumes.suggestionUnavailable'));
    }
    throw err;
  }
}

export async function deleteResume(id: string): Promise<void> {
  await apiClient<void>(`/api/v1/resumes/${id}`, { method: 'DELETE' });
}

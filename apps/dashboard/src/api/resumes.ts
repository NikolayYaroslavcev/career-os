import { API_BASE, getAccessToken } from './client';
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

export async function listResumes(): Promise<ListResumesResponse> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/resumes`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const fallbackMessage = translate('resumes.loadFailed');
    const body = await response.json().catch(() => ({ message: fallbackMessage }));
    throw new Error(body.error?.message ?? body.message ?? fallbackMessage);
  }
  return response.json();
}

export async function uploadResume(file: File): Promise<UploadResumeResponse> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/v1/resumes`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const fallbackMessage = translate('resumes.uploadFailed');
    const body = await response.json().catch(() => ({ message: fallbackMessage }));
    throw new Error(body.error?.message ?? body.message ?? fallbackMessage);
  }
  return response.json();
}

export async function getSearchProfileSuggestion(resumeId: string): Promise<SearchProfileSuggestion> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/resumes/${resumeId}/search-profile-suggestion`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const fallbackMessage = translate('resumes.suggestionFailed');
    const body = await response.json().catch(() => ({ message: fallbackMessage }));
    if (body.error?.code === 'SERVICE_UNAVAILABLE') {
      throw new Error(translate('resumes.suggestionUnavailable'));
    }
    throw new Error(body.error?.message ?? body.message ?? fallbackMessage);
  }
  return response.json();
}

export async function deleteResume(id: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/resumes/${id}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const fallbackMessage = translate('resumes.deleteFailed');
    const body = await response.json().catch(() => ({ message: fallbackMessage }));
    throw new Error(body.error?.message ?? body.message ?? fallbackMessage);
  }
}

import { apiClient, setTokens, clearTokens, getRefreshToken } from './client';

export const UserRole = {
  JOB_SEEKER: 'job_seeker',
  RECRUITER: 'recruiter',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export async function register(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<AuthResponse> {
  const response = await apiClient<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: data,
  });
  setTokens(response.accessToken, response.refreshToken);
  localStorage.setItem('user', JSON.stringify(response.user));
  return response;
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await apiClient<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: data,
  });
  setTokens(response.accessToken, response.refreshToken);
  localStorage.setItem('user', JSON.stringify(response.user));
  return response;
}

export async function refresh(refreshToken: string): Promise<RefreshResponse> {
  return apiClient<RefreshResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    // Best-effort: revoke the refresh token server-side so it can't be replayed.
    // Always clear local state after, even if the network call fails/is offline —
    // the user must not appear stuck "logged in" on this device either way.
    try {
      await apiClient('/api/v1/auth/logout', { method: 'POST', body: { refreshToken } });
    } catch {
      // ignore — token may already be expired/revoked, or the network may be down
    }
  }
  clearTokens();
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('user');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('access_token');
}

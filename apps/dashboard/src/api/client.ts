import { translate } from '@/lib/i18n/translate';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// Public auth endpoints: a 401 here means "wrong credentials" or "bad refresh
// token", not "session died" — never force-redirect on these.
const AUTH_ENDPOINTS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
]);

interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {
  method?: string;
  body?: unknown;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json() as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(customHeaders as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (response.status === 401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE}${endpoint}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          ...rest,
        });
      }
    }

    // Still unauthorized after a refresh attempt (or no refresh token to try):
    // the session is dead — e.g. a stale token from a previous docker/db reset.
    // Drop it and send the user back to login instead of surfacing a raw error.
    if (response.status === 401 && !AUTH_ENDPOINTS.has(endpoint)) {
      clearTokens();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }

  if (!response.ok) {
    const fallbackMessage = translate('common.requestFailed');
    const body = await response.json().catch(() => ({ message: fallbackMessage }));
    const message = body.error?.message ?? body.message ?? fallbackMessage;
    throw new ApiError(response.status, message, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export { setTokens, clearTokens, getAccessToken, getRefreshToken, API_BASE };

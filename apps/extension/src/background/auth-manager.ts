import type { AuthTokens, AuthUser } from '@careeros/extension-shared';
import type { StorageBridge } from './storage-bridge.js';

interface StoredAuth {
  tokens: AuthTokens;
  user: AuthUser;
}

const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000;

/** Decodes a JWT's `exp` claim (seconds since epoch) into a ms timestamp.
 * Returns null if the token isn't a well-formed JWT or has no `exp` claim. */
function decodeJwtExpiryMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export class AuthManager {
  private tokens: AuthTokens | null = null;
  private user: AuthUser | null = null;
  private backendUrl: string = 'http://localhost:3000';

  constructor(private storage: StorageBridge) {}

  async init(): Promise<void> {
    const settings = await this.storage.get<{ backend: { url: string } }>('settings');
    if (settings?.backend?.url) {
      this.backendUrl = settings.backend.url;
    }

    const stored = await this.storage.get<StoredAuth>('auth');
    if (stored) {
      this.tokens = stored.tokens;
      this.user = stored.user;
    }
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const response = await fetch(`${this.backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Login failed');
      throw new Error(error);
    }

    const data = await response.json() as {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    };

    this.tokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: decodeJwtExpiryMs(data.accessToken) ?? Date.now() + DEFAULT_TOKEN_TTL_MS,
    };
    this.user = data.user;

    await this.storage.set('auth', {
      tokens: this.tokens,
      user: this.user,
    });

    return this.user;
  }

  async logout(): Promise<void> {
    this.tokens = null;
    this.user = null;
    await this.storage.remove('auth');
  }

  isAuthenticated(): boolean {
    return this.tokens !== null && Date.now() < this.tokens.expiresAt;
  }

  getUser(): AuthUser | null {
    return this.user;
  }

  async authenticatedRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    await this.ensureValidToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${this.tokens.accessToken}`;
    }

    let response = await fetch(`${this.backendUrl}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const refreshed = await this.refresh();
      if (!refreshed) throw new Error('Session expired');

      if (this.tokens?.accessToken) {
        headers['Authorization'] = `Bearer ${this.tokens.accessToken}`;
      }

      response = await fetch(`${this.backendUrl}${path}`, {
        ...options,
        headers,
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) return;
    if (Date.now() < this.tokens.expiresAt - 60_000) return;
    await this.refresh();
  }

  private async refresh(): Promise<boolean> {
    if (!this.tokens?.refreshToken) return false;

    try {
      const response = await fetch(`${this.backendUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
      });

      if (!response.ok) {
        await this.logout();
        return false;
      }

      const data = await response.json() as { accessToken: string; refreshToken: string };
      this.tokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: decodeJwtExpiryMs(data.accessToken) ?? Date.now() + DEFAULT_TOKEN_TTL_MS,
      };

      await this.storage.set('auth', {
        tokens: this.tokens,
        user: this.user,
      });

      return true;
    } catch {
      await this.logout();
      return false;
    }
  }
}

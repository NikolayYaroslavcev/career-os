import type { AuthType } from '../types/provider.js';

export interface ProviderInfo {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedCountries: readonly string[];
  readonly supportedLanguages: readonly string[];
  readonly auth: AuthRequirements;
  readonly supportsRemote: boolean;
  readonly baseUrl: string;
  readonly docsUrl?: string;
}

export interface AuthRequirements {
  readonly type: AuthType;
  readonly requiresApiKey: boolean;
  readonly requiresOAuth: boolean;
  readonly optional: boolean;
  readonly scopes?: readonly string[];
}

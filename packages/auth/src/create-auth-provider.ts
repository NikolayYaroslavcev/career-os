import { AuthProviderImpl } from './auth-provider.js';
import type { AuthConfig, AuthProvider } from './types.js';

export function createAuthProvider(config: AuthConfig): AuthProvider {
  return new AuthProviderImpl(config);
}

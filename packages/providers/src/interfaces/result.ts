import type { ProviderErrorType } from '../errors/provider-errors.js';
import type { CursorState } from './sync-cursor.js';

export type ProviderResult<T> = ProviderSuccess<T> | ProviderError;

export interface ProviderSuccess<T> {
  readonly ok: true;
  readonly data: T;
  readonly meta: ResultMeta;
}

export interface ProviderError {
  readonly ok: false;
  readonly error: ProviderErrorType;
  readonly message: string;
  readonly retryable: boolean;
  readonly meta: ResultMeta;
}

export interface ResultMeta {
  readonly durationMs: number;
  readonly providerMeta?: Record<string, unknown>;
  readonly rateLimit?: RateLimitInfo;
  readonly cursor?: CursorState;
}

export interface RateLimitInfo {
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: Date;
}

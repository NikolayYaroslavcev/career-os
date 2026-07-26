export interface StageRetryConfig {
  readonly stageName: string;
  readonly maxAttempts: number;
  readonly backoff: 'exponential' | 'linear' | 'fixed';
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableErrors: readonly string[];
  readonly timeoutMs: number;
}

export const STAGE_RETRY_CONFIGS: Readonly<Record<string, StageRetryConfig>> = {
  scheduler: {
    stageName: 'scheduler',
    maxAttempts: 1,
    backoff: 'fixed',
    baseDelayMs: 0,
    maxDelayMs: 0,
    retryableErrors: [],
    timeoutMs: 5_000,
  },
  provider_registry: {
    stageName: 'provider_registry',
    maxAttempts: 2,
    backoff: 'exponential',
    baseDelayMs: 1_000,
    maxDelayMs: 5_000,
    retryableErrors: ['PROVIDER_UNAVAILABLE', 'NETWORK_ERROR'],
    timeoutMs: 10_000,
  },
  provider_fetch: {
    stageName: 'provider_fetch',
    maxAttempts: 3,
    backoff: 'exponential',
    baseDelayMs: 2_000,
    maxDelayMs: 30_000,
    retryableErrors: ['NETWORK_ERROR', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE'],
    timeoutMs: 60_000,
  },
  mapper: {
    stageName: 'mapper',
    maxAttempts: 1,
    backoff: 'fixed',
    baseDelayMs: 0,
    maxDelayMs: 0,
    retryableErrors: [],
    timeoutMs: 10_000,
  },
  normalizer: {
    stageName: 'normalizer',
    maxAttempts: 1,
    backoff: 'fixed',
    baseDelayMs: 0,
    maxDelayMs: 0,
    retryableErrors: [],
    timeoutMs: 10_000,
  },
  deduplication: {
    stageName: 'deduplication',
    maxAttempts: 2,
    backoff: 'exponential',
    baseDelayMs: 1_000,
    maxDelayMs: 5_000,
    retryableErrors: ['DATABASE_ERROR', 'TIMEOUT'],
    timeoutMs: 30_000,
  },
  enrichment: {
    stageName: 'enrichment',
    maxAttempts: 2,
    backoff: 'exponential',
    baseDelayMs: 2_000,
    maxDelayMs: 15_000,
    retryableErrors: ['NETWORK_ERROR', 'RATE_LIMITED'],
    timeoutMs: 30_000,
  },
  ai_matching: {
    stageName: 'ai_matching',
    maxAttempts: 2,
    backoff: 'exponential',
    baseDelayMs: 3_000,
    maxDelayMs: 30_000,
    retryableErrors: ['AI_PROVIDER_ERROR', 'RATE_LIMITED', 'TIMEOUT'],
    timeoutMs: 120_000,
  },
  scoring: {
    stageName: 'scoring',
    maxAttempts: 1,
    backoff: 'fixed',
    baseDelayMs: 0,
    maxDelayMs: 0,
    retryableErrors: [],
    timeoutMs: 10_000,
  },
  persistence: {
    stageName: 'persistence',
    maxAttempts: 3,
    backoff: 'exponential',
    baseDelayMs: 1_000,
    maxDelayMs: 10_000,
    retryableErrors: ['DATABASE_ERROR', 'TIMEOUT', 'CONFLICT'],
    timeoutMs: 30_000,
  },
  notification: {
    stageName: 'notification',
    maxAttempts: 3,
    backoff: 'exponential',
    baseDelayMs: 2_000,
    maxDelayMs: 20_000,
    retryableErrors: ['NETWORK_ERROR', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE'],
    timeoutMs: 30_000,
  },
};

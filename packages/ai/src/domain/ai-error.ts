export enum AIErrorType {
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  TIMEOUT = 'TIMEOUT',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AIError extends Error {
  readonly type: AIErrorType;
  readonly provider: string;
  readonly model?: string;
  readonly retryable: boolean;
  /** Provider-supplied hint (e.g. a `Retry-After` header) for how long to wait before retrying. */
  readonly retryAfterMs?: number;
  readonly cause?: Error;

  constructor(params: {
    type: AIErrorType;
    message: string;
    provider: string;
    model?: string;
    retryable?: boolean;
    retryAfterMs?: number;
    cause?: Error;
  }) {
    super(params.message);
    this.name = 'AIError';
    this.type = params.type;
    this.provider = params.provider;
    this.model = params.model;
    this.retryable = params.retryable ?? isRetryableByDefault(params.type);
    this.retryAfterMs = params.retryAfterMs;
    this.cause = params.cause;
  }
}

function isRetryableByDefault(type: AIErrorType): boolean {
  return type === AIErrorType.RATE_LIMITED
    || type === AIErrorType.TIMEOUT
    || type === AIErrorType.NETWORK_ERROR;
}

export class AIParseError extends AIError {
  readonly rawContent: string;

  constructor(params: {
    message: string;
    provider: string;
    rawContent: string;
    cause?: Error;
  }) {
    super({
      type: AIErrorType.PARSE_ERROR,
      message: params.message,
      provider: params.provider,
      retryable: false,
      cause: params.cause,
    });
    this.name = 'AIParseError';
    this.rawContent = params.rawContent;
  }
}

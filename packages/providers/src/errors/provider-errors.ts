export enum ProviderErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ProviderErrorJSON {
  readonly type: ProviderErrorType;
  readonly message: string;
  readonly providerId: string;
  readonly retryable: boolean;
  readonly stack?: string;
}

export abstract class ProviderErrorBase extends Error {
  abstract readonly type: ProviderErrorType;
  abstract readonly retryable: boolean;

  constructor(
    message: string,
    readonly providerId: string,
    readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON(): ProviderErrorJSON {
    return {
      type: this.type,
      message: this.message,
      providerId: this.providerId,
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}

export class ProviderNetworkError extends ProviderErrorBase {
  readonly type = ProviderErrorType.NETWORK_ERROR;
  readonly retryable = true;
}

export class ProviderAuthenticationError extends ProviderErrorBase {
  readonly type = ProviderErrorType.AUTHENTICATION_ERROR;
  readonly retryable = false;
}

export class ProviderRateLimitError extends ProviderErrorBase {
  readonly type = ProviderErrorType.RATE_LIMITED;
  readonly retryable = true;

  constructor(
    providerId: string,
    readonly retryAfterMs: number,
    cause?: Error,
  ) {
    super(`Rate limited by ${providerId}. Retry after ${retryAfterMs}ms`, providerId, cause);
  }
}

export class ProviderNotFoundError extends ProviderErrorBase {
  readonly type = ProviderErrorType.NOT_FOUND;
  readonly retryable = false;
}

export class ProviderInvalidResponseError extends ProviderErrorBase {
  readonly type = ProviderErrorType.INVALID_RESPONSE;
  readonly retryable = false;

  constructor(
    providerId: string,
    readonly statusCode: number,
    readonly responseBody?: string,
    cause?: Error,
  ) {
    super(`Invalid response from ${providerId}: HTTP ${statusCode}`, providerId, cause);
  }
}

export class ProviderUnavailableError extends ProviderErrorBase {
  readonly type = ProviderErrorType.PROVIDER_UNAVAILABLE;
  readonly retryable = true;
}

export class ProviderConfigurationError extends ProviderErrorBase {
  readonly type = ProviderErrorType.CONFIGURATION_ERROR;
  readonly retryable = false;
}

export class ProviderUnknownError extends ProviderErrorBase {
  readonly type = ProviderErrorType.UNKNOWN_ERROR;
  readonly retryable = true;
}

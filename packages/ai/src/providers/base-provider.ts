import type { AIProvider, AIProviderConfig } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities } from '../domain/ai-types.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';

/**
 * Strips potential API key fragments from error response bodies before they
 * propagate into logs or thrown errors. Matches common key prefixes used by
 * the providers we support (sk-, gsk_, sk-ant-, etc.) and masks everything
 * on the same line that looks like a key value.
 */
export function sanitizeErrorBody(body: string): string {
  return body
    .replace(/["']?(?:key|api[_-]?key|token|secret|authorization)["']?\s*[:=]\s*["']?[A-Za-z0-9_./-]{20,}["']?/gi, '[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9]{20,})\b/g, '[REDACTED]')
    .replace(/\b(gsk_[A-Za-z0-9]{20,})\b/g, '[REDACTED]')
    .replace(/\b(sk-ant-[A-Za-z0-9_-]{20,})\b/g, '[REDACTED]');
}

/** Node/undici system errors expose a `.code` alongside `.message`; walk `.cause` to find them instead of guessing from text. */
function collectErrorChain(error: unknown, maxDepth = 5): Array<Error & { code?: string }> {
  const chain: Array<Error & { code?: string }> = [];
  let current: unknown = error;
  for (let depth = 0; depth < maxDepth && current instanceof Error; depth += 1) {
    chain.push(current as Error & { code?: string });
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

function chainHasCode(chain: Array<Error & { code?: string }>, codes: ReadonlySet<string>): boolean {
  return chain.some((entry) => typeof entry.code === 'string' && codes.has(entry.code));
}

function chainMessage(chain: Array<Error & { code?: string }>): string {
  return chain.map((entry) => entry.message).join(' ').toLowerCase();
}

// Connection-level failures that are worth retrying — the same request against
// the same host may well succeed a moment later.
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNABORTED',
  'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE',
]);

// Certificate validation failures are a persistent misconfiguration (expired/
// untrusted/mismatched cert) — retrying against the same host reproduces them.
const CERTIFICATE_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'SELF_SIGNED_CERT_IN_CHAIN', 'CERT_UNTRUSTED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

function isCertificateError(chain: Array<Error & { code?: string }>): boolean {
  if (chainHasCode(chain, CERTIFICATE_ERROR_CODES)) return true;
  const text = chainMessage(chain);
  return text.includes('certificate') || text.includes('self signed certificate') || text.includes('self-signed certificate');
}

function isTransientNetworkError(chain: Array<Error & { code?: string }>): boolean {
  if (chainHasCode(chain, TRANSIENT_NETWORK_CODES)) return true;
  const text = chainMessage(chain);
  return text.includes('ssl routines') || text.includes('handshake failure') || text.includes('socket hang up');
}

function isJsonParseError(error: unknown, lowerMessage: string): boolean {
  if (error instanceof SyntaxError) return true;
  return lowerMessage.includes('unexpected token') || lowerMessage.includes('unexpected end of json input') || lowerMessage.includes('is not valid json');
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;

  protected readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const result = await this.doComplete(request);
      const latencyMs = Date.now() - startTime;

      return {
        ...result,
        latencyMs,
        provider: this.name,
      };
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      throw new AIError({
        type: this.classifyError(error),
        message: error instanceof Error ? error.message : String(error),
        provider: this.name,
        model: request.model ?? this.defaultModel,
        retryable: this.isRetryableError(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  abstract getCapabilities(): AICapabilities;

  validateConfig(): boolean {
    return Boolean(this.config.apiKey);
  }

  protected abstract doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>>;

  protected classifyError(error: unknown): AIErrorType {
    if (error instanceof AIError) return error.type;

    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    // AbortSignal.timeout() rejects with a DOMException whose message doesn't
    // contain "timeout" (e.g. "The operation was aborted") — check .name too.
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return AIErrorType.TIMEOUT;
    }

    // All providers throw `${Provider} API error ${status}: ${body}` on a
    // non-ok response — pull the status out directly rather than guessing
    // from body text, which varies per provider.
    const statusMatch = message.match(/\bAPI error (\d{3})\b/i);
    const httpStatus = statusMatch ? Number(statusMatch[1]) : undefined;

    if (httpStatus === 401 || httpStatus === 403) {
      return AIErrorType.AUTHENTICATION_ERROR;
    }
    // 504 Gateway Timeout is a timeout by definition; 500/502/503 are
    // transient upstream/infra failures — both are worth retrying.
    if (httpStatus === 504) {
      return AIErrorType.TIMEOUT;
    }
    if (httpStatus === 500 || httpStatus === 502 || httpStatus === 503) {
      return AIErrorType.NETWORK_ERROR;
    }

    // Checked before the quota branch: Groq (and other providers) report
    // request-too-large / TPM rate limiting as HTTP 413 with a
    // `rate_limit_exceeded` code, e.g. "Request too large for model ...
    // tokens per minute (TPM): Limit 6000, Requested 6231 ... code:
    // rate_limit_exceeded". That message also contains the word "exceeded",
    // which used to fall through to the generic quota check below and get
    // misclassified as QUOTA_EXCEEDED (non-retryable) instead of a
    // retryable rate limit.
    if (
      lower.includes('rate limit') ||
      lower.includes('rate_limit_exceeded') ||
      lower.includes('tokens per minute') ||
      lower.includes('request too large') ||
      lower.includes('429') ||
      lower.includes('413')
    ) {
      return AIErrorType.RATE_LIMITED;
    }
    if (lower.includes('timeout') || lower.includes('timed out')) {
      return AIErrorType.TIMEOUT;
    }
    if (lower.includes('auth') || lower.includes('401') || lower.includes('403')) {
      return AIErrorType.AUTHENTICATION_ERROR;
    }
    if (lower.includes('quota') || lower.includes('insufficient_quota') || lower.includes('billing')) {
      return AIErrorType.QUOTA_EXCEEDED;
    }

    const chain = collectErrorChain(error);

    // Certificate errors are classified as NETWORK_ERROR (there's no better
    // bucket) but isRetryableError overrides them to non-retryable below —
    // a bad cert reproduces on every retry against the same host.
    if (isCertificateError(chain)) {
      return AIErrorType.NETWORK_ERROR;
    }
    if (isTransientNetworkError(chain) || lower.includes('network') || lower.includes('econnrefused')) {
      return AIErrorType.NETWORK_ERROR;
    }
    if (isJsonParseError(error, lower)) {
      return AIErrorType.PARSE_ERROR;
    }

    return AIErrorType.PROVIDER_ERROR;
  }

  protected isRetryableError(error: unknown): boolean {
    if (isCertificateError(collectErrorChain(error))) {
      return false;
    }

    const type = this.classifyError(error);
    return type === AIErrorType.RATE_LIMITED
      || type === AIErrorType.TIMEOUT
      || type === AIErrorType.NETWORK_ERROR;
  }
}

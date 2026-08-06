import { describe, it, expect, vi } from 'vitest';
import { FallbackAIProvider } from '../providers/fallback-ai-provider.js';
import { OpenAIProvider } from '../providers/openai-provider.js';
import { AnthropicProvider } from '../providers/anthropic-provider.js';
import { AIRetryPolicy } from '../resilience/retry-policy.js';
import { AIProviderHealthMonitor } from '../resilience/health-monitor.js';
import { AIConcurrencyLimiter } from '../resilience/concurrency-limiter.js';
import { InMemoryAIMetricsCollector, AI_METRICS } from '../observability/ai-metrics.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import type { AIProvider } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities } from '../domain/ai-types.js';

const baseRequest: AIRequest = { prompt: 'hi', promptId: 'p', promptVersion: '1', promptChecksum: 'c' };

function makeResponse(overrides: Partial<AIResponse> = {}): AIResponse {
  return {
    content: 'ok',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    model: 'test-model',
    provider: 'test',
    latencyMs: 5,
    confidence: 0.9,
    requestId: 'req-1',
    ...overrides,
  };
}

function makeProvider(name: string): AIProvider & { complete: ReturnType<typeof vi.fn> } {
  return {
    name,
    defaultModel: `${name}-model`,
    complete: vi.fn(),
    getCapabilities: vi.fn(
      (): AICapabilities => ({ supportsStreaming: false, supportsVision: false, maxTokens: 4000, supportedModels: [] })
    ),
    validateConfig: vi.fn(() => true),
  };
}

// Zero backoff so tests using the retry policy don't need fake timers.
const noDelayRetryPolicy = (): AIRetryPolicy => new AIRetryPolicy({ maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false });

describe('FallbackAIProvider', () => {
  it('throws when constructed with no providers', () => {
    expect(() => new FallbackAIProvider([])).toThrow();
  });

  it('reports the primary provider identity and delegates capabilities/validateConfig', () => {
    const primary = makeProvider('primary');
    const fallback = new FallbackAIProvider([primary, makeProvider('secondary')]);

    expect(fallback.name).toBe('primary');
    expect(fallback.defaultModel).toBe('primary-model');
    fallback.getCapabilities();
    fallback.validateConfig();
    expect(primary.getCapabilities).toHaveBeenCalledTimes(1);
    expect(primary.validateConfig).toHaveBeenCalledTimes(1);
  });

  it('returns the primary provider response on success without touching fallbacks', async () => {
    const primary = makeProvider('primary');
    const secondary = makeProvider('secondary');
    primary.complete.mockResolvedValue(makeResponse());
    const fallback = new FallbackAIProvider([primary, secondary]);

    const response = await fallback.complete(baseRequest);

    expect(response.content).toBe('ok');
    expect(primary.complete).toHaveBeenCalledTimes(1);
    expect(secondary.complete).not.toHaveBeenCalled();
  });

  it('does not advance to the next provider on a non-retryable error', async () => {
    const primary = makeProvider('primary');
    const secondary = makeProvider('secondary');
    const authError = new AIError({ type: AIErrorType.AUTHENTICATION_ERROR, message: 'bad key', provider: 'primary', retryable: false });
    primary.complete.mockRejectedValue(authError);
    const fallback = new FallbackAIProvider([primary, secondary], { retryPolicy: noDelayRetryPolicy() });

    await expect(fallback.complete(baseRequest)).rejects.toBe(authError);
    expect(secondary.complete).not.toHaveBeenCalled();
  });

  it('advances to the next provider once the primary exhausts its retry budget on a retryable error', async () => {
    const primary = makeProvider('primary');
    const secondary = makeProvider('secondary');
    const rateLimitError = new AIError({ type: AIErrorType.RATE_LIMITED, message: 'rate limited', provider: 'primary', retryable: true });
    primary.complete.mockRejectedValue(rateLimitError);
    secondary.complete.mockResolvedValue(makeResponse({ provider: 'secondary' }));

    const fallback = new FallbackAIProvider([primary, secondary], {
      retryPolicy: new AIRetryPolicy({ maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false }),
    });

    const response = await fallback.complete(baseRequest);

    expect(response.provider).toBe('secondary');
    expect(primary.complete).toHaveBeenCalledTimes(2); // exhausted its own 2-attempt retry budget
    expect(secondary.complete).toHaveBeenCalledTimes(1);
  });

  it('skips a provider the health monitor has marked unavailable', async () => {
    const primary = makeProvider('primary');
    const secondary = makeProvider('secondary');
    secondary.complete.mockResolvedValue(makeResponse({ provider: 'secondary' }));

    const healthMonitor = new AIProviderHealthMonitor({ unhealthyThreshold: 1, recoveryAfterMs: 60_000, latencyWindowSize: 10 });
    healthMonitor.recordFailure('primary');

    const fallback = new FallbackAIProvider([primary, secondary], { healthMonitor, retryPolicy: noDelayRetryPolicy() });

    const response = await fallback.complete(baseRequest);

    expect(response.provider).toBe('secondary');
    expect(primary.complete).not.toHaveBeenCalled();
  });

  it('throws a synthesized error when every provider in the chain is unavailable', async () => {
    const primary = makeProvider('primary');
    const secondary = makeProvider('secondary');

    const healthMonitor = new AIProviderHealthMonitor({ unhealthyThreshold: 1, recoveryAfterMs: 60_000, latencyWindowSize: 10 });
    healthMonitor.recordFailure('primary');
    healthMonitor.recordFailure('secondary');

    const fallback = new FallbackAIProvider([primary, secondary], { healthMonitor });

    await expect(fallback.complete(baseRequest)).rejects.toThrow(AIError);
    expect(primary.complete).not.toHaveBeenCalled();
    expect(secondary.complete).not.toHaveBeenCalled();
  });

  it('records success/failure into the health monitor and emits metrics for every call, including retries', async () => {
    const primary = makeProvider('primary');
    const rateLimitError = new AIError({ type: AIErrorType.RATE_LIMITED, message: 'rate limited', provider: 'primary', retryable: true });
    primary.complete.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce(makeResponse({ provider: 'primary' }));

    const metrics = new InMemoryAIMetricsCollector();
    const healthMonitor = new AIProviderHealthMonitor();
    const fallback = new FallbackAIProvider([primary], { metrics, healthMonitor, retryPolicy: noDelayRetryPolicy() });

    await fallback.complete(baseRequest);

    expect(metrics.getCounter(AI_METRICS.REQUEST_STARTED)).toBe(2); // one failed attempt + one successful attempt
    expect(metrics.getCounter(AI_METRICS.PROVIDER_FAILURE)).toBe(1);
    expect(metrics.getCounter(AI_METRICS.PROVIDER_SUCCESS)).toBe(1);
    expect(metrics.getHistogram(AI_METRICS.TOKENS_TOTAL)).toEqual([30]);
    expect(healthMonitor.getStatus('primary')?.consecutiveFailures).toBe(0); // reset by the eventual success
  });

  it('routes complete() through the injected concurrency limiter', async () => {
    const primary = makeProvider('primary');
    let resolveComplete!: (response: AIResponse) => void;
    primary.complete.mockImplementation(
      () => new Promise<AIResponse>((resolve) => {
        resolveComplete = resolve;
      })
    );

    const concurrencyLimiter = new AIConcurrencyLimiter(1);
    const fallback = new FallbackAIProvider([primary], { concurrencyLimiter, retryPolicy: noDelayRetryPolicy() });

    const inFlight = fallback.complete(baseRequest);
    expect(concurrencyLimiter.activeCount).toBe(1);

    // The limiter's own `await acquire()` needs a microtask turn to resume
    // before execution cascades down to provider.complete() and assigns
    // resolveComplete — flush that turn before calling it.
    await Promise.resolve();

    resolveComplete(makeResponse());
    await inFlight;

    expect(concurrencyLimiter.activeCount).toBe(0);
  });

  it('falls back from a real primary provider to a real secondary provider on a transient 503', async () => {
    const originalFetch = global.fetch;
    try {
      const fetchMock = vi.fn()
        // Primary (OpenAI) 503s on every attempt within its retry budget.
        .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('{"error":{"message":"unavailable"}}') })
        .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('{"error":{"message":"unavailable"}}') })
        // Secondary (Anthropic) succeeds.
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ content: [{ text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }),
        });
      global.fetch = fetchMock;

      const primary = new OpenAIProvider({ apiKey: 'openai-key' });
      const secondary = new AnthropicProvider({ apiKey: 'anthropic-key' });
      const fallback = new FallbackAIProvider([primary, secondary], {
        retryPolicy: new AIRetryPolicy({ maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false }),
      });

      const response = await fallback.complete(baseRequest);

      expect(response.content).toBe('ok');
      expect(response.provider).toBe('anthropic');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

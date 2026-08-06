import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from '../providers/anthropic-provider.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import { AIRetryPolicy } from '../resilience/retry-policy.js';

const request = { prompt: 'Analyze this resume', promptId: 'resume-analysis', promptVersion: '1.0', promptChecksum: 'abc' };

function mockOkResponse(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

function mockErrorResponse(status: number, body = '{"error":{"message":"upstream failure"}}'): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  });
}

function mockRejectedFetch(error: Error): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(error);
}

function mockInvalidJsonResponse(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve('not json'),
    json: () => Promise.reject(new SyntaxError('Unexpected token o in JSON at position 1')),
  });
}

describe('AnthropicProvider', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('completes a request successfully', async () => {
    global.fetch = mockOkResponse({
      content: [{ text: '{"score": 85}' }],
      usage: { input_tokens: 50, output_tokens: 100 },
    });

    const provider = new AnthropicProvider({ apiKey: 'key' });
    const result = await provider.complete(request);

    expect(result.content).toBe('{"score": 85}');
    expect(result.provider).toBe('anthropic');
  });

  it.each([500, 502, 503])('classifies an HTTP %d response as a retryable NETWORK_ERROR', async (status) => {
    global.fetch = mockErrorResponse(status);
    const provider = new AnthropicProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIError);
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies an HTTP 504 response as a retryable TIMEOUT', async () => {
    global.fetch = mockErrorResponse(504, '{"error":{"message":"upstream connection closed unexpectedly"}}');
    const provider = new AnthropicProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.TIMEOUT);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies a DNS resolution failure surfaced via fetch as a retryable NETWORK_ERROR', async () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND api.anthropic.com'), { code: 'ENOTFOUND' });
    global.fetch = mockRejectedFetch(Object.assign(new TypeError('fetch failed'), { cause }));
    const provider = new AnthropicProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies a self-signed certificate failure surfaced via fetch as a non-retryable failure', async () => {
    const cause = Object.assign(new Error('self signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' });
    global.fetch = mockRejectedFetch(Object.assign(new TypeError('fetch failed'), { cause }));
    const provider = new AnthropicProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.retryable).toBe(false);
    }
  });

  it('classifies an invalid JSON response body as a non-retryable PARSE_ERROR', async () => {
    global.fetch = mockInvalidJsonResponse();
    const provider = new AnthropicProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.PARSE_ERROR);
      expect(aiError.retryable).toBe(false);
    }
  });

  it('retries a transient 502 and succeeds once the upstream recovers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, text: () => Promise.resolve('{"error":{"message":"bad gateway"}}') })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: [{ text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }),
      });
    global.fetch = fetchMock;

    const provider = new AnthropicProvider({ apiKey: 'key' });
    const policy = new AIRetryPolicy({ maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false });

    const result = await policy.execute(() => provider.complete(request));

    expect(result.content).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

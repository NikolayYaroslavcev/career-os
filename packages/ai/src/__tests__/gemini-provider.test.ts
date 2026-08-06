import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '../providers/gemini-provider.js';
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

describe('GeminiProvider', () => {
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
      candidates: [{ content: { parts: [{ text: '{"score": 85}' }] } }],
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 100, totalTokenCount: 150 },
    });

    const provider = new GeminiProvider({ apiKey: 'key' });
    const result = await provider.complete(request);

    expect(result.content).toBe('{"score": 85}');
    expect(result.provider).toBe('gemini');
  });

  it.each([500, 502, 503])('classifies an HTTP %d response as a retryable NETWORK_ERROR', async (status) => {
    global.fetch = mockErrorResponse(status);
    const provider = new GeminiProvider({ apiKey: 'key' });

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
    const provider = new GeminiProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.TIMEOUT);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies a connection-abort failure surfaced via fetch as a retryable NETWORK_ERROR', async () => {
    const cause = Object.assign(new Error('connection aborted'), { code: 'ECONNABORTED' });
    global.fetch = mockRejectedFetch(Object.assign(new TypeError('fetch failed'), { cause }));
    const provider = new GeminiProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies a mid-handshake socket failure surfaced via fetch as a retryable NETWORK_ERROR', async () => {
    // A protocol-level handshake failure (not a certificate validation problem) is transient — the same host may succeed on retry.
    const cause = new Error('140736:error:1408F10B:SSL routines:ssl3_get_record:wrong version number');
    global.fetch = mockRejectedFetch(Object.assign(new TypeError('fetch failed'), { cause }));
    const provider = new GeminiProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies an invalid JSON response body as a non-retryable PARSE_ERROR', async () => {
    global.fetch = mockInvalidJsonResponse();
    const provider = new GeminiProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.PARSE_ERROR);
      expect(aiError.retryable).toBe(false);
    }
  });

  it('retries a transient 500 and succeeds once the upstream recovers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('{"error":{"message":"internal error"}}') })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
        }),
      });
    global.fetch = fetchMock;

    const provider = new GeminiProvider({ apiKey: 'key' });
    const policy = new AIRetryPolicy({ maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false });

    const result = await policy.execute(() => provider.complete(request));

    expect(result.content).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

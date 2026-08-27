import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterProvider } from '../providers/openrouter-provider.js';
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

describe('OpenRouterProvider', () => {
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
      choices: [{ message: { content: '{"score": 85}' } }],
      usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
    });

    const provider = new OpenRouterProvider({ apiKey: 'key' });
    const result = await provider.complete(request);

    expect(result.content).toBe('{"score": 85}');
    expect(result.provider).toBe('openrouter');
  });

  it('sends the exact endpoint, headers, and body OpenRouter\'s chat completions API expects', async () => {
    const fetchMock = mockOkResponse({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    global.fetch = fetchMock;

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test-key' });
    await provider.complete({ ...request, systemPrompt: 'You are a helpful assistant' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-or-test-key');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('openai/gpt-4o');
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Analyze this resume' },
    ]);
  });

  it.each([500, 502, 503])('classifies an HTTP %d response as a retryable NETWORK_ERROR', async (status) => {
    global.fetch = mockErrorResponse(status);
    const provider = new OpenRouterProvider({ apiKey: 'key' });

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
    const provider = new OpenRouterProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.TIMEOUT);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies a DNS lookup retry exhaustion (EAI_AGAIN) surfaced via fetch as a retryable NETWORK_ERROR', async () => {
    const cause = Object.assign(new Error('getaddrinfo EAI_AGAIN openrouter.ai'), { code: 'EAI_AGAIN' });
    global.fetch = mockRejectedFetch(Object.assign(new TypeError('fetch failed'), { cause }));
    const provider = new OpenRouterProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies an untrusted certificate chain surfaced via fetch as a non-retryable failure', async () => {
    const cause = Object.assign(new Error('unable to verify the first certificate'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' });
    global.fetch = mockRejectedFetch(Object.assign(new TypeError('fetch failed'), { cause }));
    const provider = new OpenRouterProvider({ apiKey: 'key' });

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
    const provider = new OpenRouterProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.PARSE_ERROR);
      expect(aiError.retryable).toBe(false);
    }
  });

  it('retries a transient 503 and succeeds once the upstream recovers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('{"error":{"message":"unavailable"}}') })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });
    global.fetch = fetchMock;

    const provider = new OpenRouterProvider({ apiKey: 'key' });
    const policy = new AIRetryPolicy({ maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false });

    const result = await policy.execute(() => provider.complete(request));

    expect(result.content).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

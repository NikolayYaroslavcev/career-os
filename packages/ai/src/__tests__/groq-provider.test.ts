import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GroqProvider } from '../providers/groq-provider.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import { AIRetryPolicy } from '../resilience/retry-policy.js';

function createMockFetch(response: unknown, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(response)),
    json: () => Promise.resolve(response),
  });
}

const request = { prompt: 'test', promptId: 'test', promptVersion: '1.0', promptChecksum: 'abc' };

describe('GroqProvider', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('has correct name and default model', () => {
    const provider = new GroqProvider({ apiKey: 'test-key' });
    expect(provider.name).toBe('groq');
    expect(provider.defaultModel).toBe('llama-3.3-70b-versatile');
  });

  it('uses custom model from config', () => {
    const provider = new GroqProvider({ apiKey: 'test-key', model: 'mixtral-8x7b-32768' });
    expect(provider.defaultModel).toBe('mixtral-8x7b-32768');
  });

  it('returns correct capabilities', () => {
    const provider = new GroqProvider({ apiKey: 'test-key' });
    const caps = provider.getCapabilities();
    expect(caps.supportsStreaming).toBe(true);
    expect(caps.supportsVision).toBe(false);
    expect(caps.maxTokens).toBe(32768);
    expect(caps.supportedModels).toContain('llama-3.3-70b-versatile');
  });

  it('validates config correctly', () => {
    expect(new GroqProvider({ apiKey: 'key' }).validateConfig()).toBe(true);
    expect(new GroqProvider({ apiKey: '' }).validateConfig()).toBe(false);
  });

  it('sends correct request to Groq API', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"score": 85}' } }],
      usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
    };
    global.fetch = createMockFetch(mockResponse);

    const provider = new GroqProvider({ apiKey: 'gsk_test' });
    const result = await provider.complete({
      prompt: 'Analyze this resume',
      systemPrompt: 'You are a career advisor',
      promptId: 'resume-analysis',
      promptVersion: '1.0',
      promptChecksum: 'abc',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer gsk_test',
        },
      })
    );

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const sentBody = JSON.parse((calls[0]?.[1] as { body: string } | undefined)?.body ?? '{}');
    expect(sentBody.model).toBe('llama-3.3-70b-versatile');
    expect(sentBody.messages).toEqual([
      { role: 'system', content: 'You are a career advisor' },
      { role: 'user', content: 'Analyze this resume' },
    ]);

    expect(result.content).toBe('{"score": 85}');
    expect(result.provider).toBe('groq');
    expect(result.model).toBe('llama-3.3-70b-versatile');
    expect(result.usage.promptTokens).toBe(50);
    expect(result.usage.completionTokens).toBe(100);
    expect(result.usage.totalTokens).toBe(150);
  });

  it('uses custom base URL when provided', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };
    global.fetch = createMockFetch(mockResponse);

    const provider = new GroqProvider({ apiKey: 'key', baseUrl: 'https://custom.groq.com/v1' });
    await provider.complete({
      prompt: 'test',
      promptId: 'test',
      promptVersion: '1.0',
      promptChecksum: 'abc',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://custom.groq.com/v1/chat/completions',
      expect.anything()
    );
  });

  it('throws AIError on API failure', async () => {
    global.fetch = createMockFetch({ error: 'Unauthorized' }, 401);

    const provider = new GroqProvider({ apiKey: 'bad-key' });
    await expect(provider.complete({
      prompt: 'test',
      promptId: 'test',
      promptVersion: '1.0',
      promptChecksum: 'abc',
    })).rejects.toThrow(AIError);
  });

  it('classifies rate limit errors as retryable', async () => {
    global.fetch = createMockFetch({ error: 'Rate limit exceeded' }, 429);

    const provider = new GroqProvider({ apiKey: 'key' });
    try {
      await provider.complete({
        prompt: 'test',
        promptId: 'test',
        promptVersion: '1.0',
        promptChecksum: 'abc',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIError);
      expect((error as AIError).retryable).toBe(true);
    }
  });

  it('classifies a Groq 413 "request too large" / rate_limit_exceeded response as RATE_LIMITED and retryable, not QUOTA_EXCEEDED', async () => {
    const groqRateLimitBody = {
      error: {
        message:
          'Request too large for model `llama-3.1-8b-instant` in organization `org_123` service tier `on_demand` ' +
          'on tokens per minute (TPM): Limit 6000, Used 0, Requested 6231. Please try again in 2.31s. ' +
          'Visit https://console.groq.com/docs/rate-limits for more information.',
        type: 'tokens',
        code: 'rate_limit_exceeded',
      },
    };
    global.fetch = createMockFetch(groqRateLimitBody, 413);

    const provider = new GroqProvider({ apiKey: 'key' });
    try {
      await provider.complete({
        prompt: 'test',
        promptId: 'test',
        promptVersion: '1.0',
        promptChecksum: 'abc',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIError);
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.RATE_LIMITED);
      expect(aiError.type).not.toBe(AIErrorType.QUOTA_EXCEEDED);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('omits system prompt when not provided', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };
    global.fetch = createMockFetch(mockResponse);

    const provider = new GroqProvider({ apiKey: 'key' });
    await provider.complete({
      prompt: 'test',
      promptId: 'test',
      promptVersion: '1.0',
      promptChecksum: 'abc',
    });

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const sentBody = JSON.parse((calls[0]?.[1] as { body: string } | undefined)?.body ?? '{}');
    expect(sentBody.messages).toEqual([
      { role: 'user', content: 'test' },
    ]);
  });

  it.each([500, 502, 503])('classifies an HTTP %d response as a retryable NETWORK_ERROR', async (status) => {
    global.fetch = createMockFetch({ error: 'upstream failure' }, status);
    const provider = new GroqProvider({ apiKey: 'key' });

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
    global.fetch = createMockFetch({ error: 'upstream connection closed unexpectedly' }, 504);
    const provider = new GroqProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.TIMEOUT);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies a connect-timeout failure surfaced via fetch as a retryable NETWORK_ERROR', async () => {
    const cause = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
    global.fetch = vi.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause }));
    const provider = new GroqProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(aiError.retryable).toBe(true);
    }
  });

  it('classifies a certificate hostname mismatch surfaced via fetch as a non-retryable failure', async () => {
    const cause = Object.assign(new Error("Hostname/IP does not match certificate's altnames"), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
    global.fetch = vi.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause }));
    const provider = new GroqProvider({ apiKey: 'key' });

    try {
      await provider.complete(request);
      expect.fail('Should have thrown');
    } catch (error) {
      const aiError = error as AIError;
      expect(aiError.retryable).toBe(false);
    }
  });

  it('classifies an invalid JSON response body as a non-retryable PARSE_ERROR', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('not json'),
      json: () => Promise.reject(new SyntaxError('Unexpected token o in JSON at position 1')),
    });
    const provider = new GroqProvider({ apiKey: 'key' });

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
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('{"error":"internal error"}') })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });
    global.fetch = fetchMock;

    const provider = new GroqProvider({ apiKey: 'key' });
    const policy = new AIRetryPolicy({ maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false });

    const result = await policy.execute(() => provider.complete(request));

    expect(result.content).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

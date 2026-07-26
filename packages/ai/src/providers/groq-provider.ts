import type { AIProviderConfig } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities, TokenUsage } from '../domain/ai-types.js';
import { BaseAIProvider, sanitizeErrorBody } from './base-provider.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';

export class GroqProvider extends BaseAIProvider {
  readonly name = 'groq';
  readonly defaultModel: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.defaultModel = config.model ?? 'llama-3.3-70b-versatile';
  }

  getCapabilities(): AICapabilities {
    return {
      supportsStreaming: true,
      supportsVision: false,
      maxTokens: 32768,
      supportedModels: [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama-3.1-70b-versatile',
        'mixtral-8x7b-32768',
        'gemma2-9b-it',
      ],
    };
  }

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    const model = request.model ?? this.defaultModel;
    const baseUrl = this.config.baseUrl ?? 'https://api.groq.com/openai/v1';

    const body = {
      model,
      messages: [
        ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
        { role: 'user' as const, content: request.prompt },
      ],
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4000,
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 60_000),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      // Groq returns 429 for TPM/RPM rate limits with a `Retry-After` header
      // (seconds). Surface it as an AIError up front so the matching engine's
      // retry loop can honor the provider's own cooldown instead of guessing.
      if (response.status === 429) {
        const retryAfterHeader = response.headers?.get?.('retry-after');
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;

        throw new AIError({
          type: AIErrorType.RATE_LIMITED,
          message: `Groq API error ${response.status}: ${sanitizeErrorBody(errorBody)}`,
          provider: this.name,
          model,
          retryable: true,
          retryAfterMs: retryAfterMs && Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
        });
      }

      throw new Error(`Groq API error ${response.status}: ${sanitizeErrorBody(errorBody)}`);
    }

    const data = await response.json() as GroqChatResponse;
    const content = data.choices[0]?.message?.content ?? '';
    const usage: TokenUsage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    };

    return {
      content,
      usage,
      model,
      confidence: 0.8,
      requestId: crypto.randomUUID(),
    };
  }
}

interface GroqChatResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

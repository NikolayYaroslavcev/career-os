import type { AIProviderConfig } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities, TokenUsage } from '../domain/ai-types.js';
import { BaseAIProvider, sanitizeErrorBody } from './base-provider.js';

export class AnthropicProvider extends BaseAIProvider {
  readonly name = 'anthropic';
  readonly defaultModel: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.defaultModel = config.model ?? 'claude-sonnet-4-20250514';
  }

  getCapabilities(): AICapabilities {
    return {
      supportsStreaming: true,
      supportsVision: true,
      maxTokens: 200000,
      supportedModels: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    };
  }

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    const model = request.model ?? this.defaultModel;
    const baseUrl = this.config.baseUrl ?? 'https://api.anthropic.com/v1';

    const body = {
      model,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4000,
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
      messages: [
        { role: 'user' as const, content: request.prompt },
      ],
    };

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 60_000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${sanitizeErrorBody(errorBody)}`);
    }

    const data = await response.json() as AnthropicResponse;
    const content = data.content[0]?.text ?? '';
    const usage: TokenUsage = {
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
      totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
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

interface AnthropicResponse {
  content: Array<{ text: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

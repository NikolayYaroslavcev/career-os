import type { AIProviderConfig } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities, TokenUsage } from '../domain/ai-types.js';
import { BaseAIProvider, sanitizeErrorBody } from './base-provider.js';

export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'openai';
  readonly defaultModel: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.defaultModel = config.model ?? 'gpt-4o';
  }

  getCapabilities(): AICapabilities {
    return {
      supportsStreaming: true,
      supportsVision: true,
      maxTokens: 128000,
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    };
  }

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    const model = request.model ?? this.defaultModel;
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';

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
      throw new Error(`OpenAI API error ${response.status}: ${sanitizeErrorBody(errorBody)}`);
    }

    const data = await response.json() as OpenAIChatResponse;
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

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

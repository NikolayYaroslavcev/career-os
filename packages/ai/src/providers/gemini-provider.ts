import type { AIProviderConfig } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities, TokenUsage } from '../domain/ai-types.js';
import { BaseAIProvider, sanitizeErrorBody } from './base-provider.js';

export class GeminiProvider extends BaseAIProvider {
  readonly name = 'gemini';
  readonly defaultModel: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.defaultModel = config.model ?? 'gemini-2.0-flash';
  }

  getCapabilities(): AICapabilities {
    return {
      supportsStreaming: true,
      supportsVision: true,
      maxTokens: 1000000,
      supportedModels: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-pro'],
    };
  }

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    const model = request.model ?? this.defaultModel;
    const baseUrl = this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';

    const contents = [];
    if (request.systemPrompt) {
      contents.push({
        role: 'user' as const,
        parts: [{ text: request.systemPrompt }],
      });
      contents.push({
        role: 'model' as const,
        parts: [{ text: 'Understood. I will follow these instructions.' }],
      });
    }
    contents.push({
      role: 'user' as const,
      parts: [{ text: request.prompt }],
    });

    const body = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 4000,
      },
    };

    const response = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 60_000),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${sanitizeErrorBody(errorBody)}`);
    }

    const data = await response.json() as GeminiResponse;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const usage: TokenUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
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

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text: string }> } }>;
  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
}

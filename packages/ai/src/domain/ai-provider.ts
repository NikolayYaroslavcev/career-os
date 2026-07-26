import type { AIRequest, AIResponse, AICapabilities, TokenUsage } from './ai-types.js';

export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;

  complete(request: AIRequest): Promise<AIResponse>;

  getCapabilities(): AICapabilities;

  validateConfig(): boolean;
}

export interface AIProviderConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
}

export interface AIProviderFactory {
  createProvider(config: AIProviderConfig): AIProvider;
}

export function extractTokenUsage(response: AIResponse): TokenUsage {
  return response.usage;
}

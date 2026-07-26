export interface AIRequest {
  readonly prompt: string;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly promptChecksum: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly systemPrompt?: string;
}

export interface AIResponse {
  readonly content: string;
  readonly usage: TokenUsage;
  readonly model: string;
  readonly provider: string;
  readonly latencyMs: number;
  readonly confidence: number;
  readonly requestId: string;
}

export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface AICapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsVision: boolean;
  readonly maxTokens: number;
  readonly supportedModels: readonly string[];
}

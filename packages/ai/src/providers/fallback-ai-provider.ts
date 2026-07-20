import type { AIProvider } from '../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities } from '../domain/ai-types.js';
import { AIError, AIErrorType } from '../domain/ai-error.js';
import type { AIMetricsCollector } from '../observability/ai-metrics.js';
import { AI_METRICS } from '../observability/ai-metrics.js';
import type { AILogger } from '../observability/ai-logger.js';
import { AIRetryPolicy } from '../resilience/retry-policy.js';
import { AIProviderHealthMonitor } from '../resilience/health-monitor.js';

export interface FallbackAIProviderOptions {
  readonly retryPolicy?: AIRetryPolicy;
  readonly healthMonitor?: AIProviderHealthMonitor;
  readonly metrics?: AIMetricsCollector;
  readonly logger?: AILogger;
}

/**
 * Wraps an ordered chain of AIProviders as a single AIProvider. The first
 * entry is the "primary" — its name/defaultModel/capabilities are what this
 * wrapper reports, so it's a drop-in replacement for a bare single provider
 * (a one-element chain behaves identically to the wrapped provider, plus
 * retry + metrics + health tracking).
 *
 * On a retryable failure (after that provider's own retry budget is spent),
 * advances to the next provider in the chain. Non-retryable failures (bad
 * prompt, auth error) propagate immediately — trying another vendor won't
 * fix a bad request.
 */
export class FallbackAIProvider implements AIProvider {
  readonly name: string;
  readonly defaultModel: string;

  private readonly providers: readonly AIProvider[];
  private readonly retryPolicy: AIRetryPolicy;
  private readonly healthMonitor: AIProviderHealthMonitor;
  private readonly metrics: AIMetricsCollector | undefined;
  private readonly logger: AILogger | undefined;

  constructor(providers: readonly AIProvider[], options: FallbackAIProviderOptions = {}) {
    if (providers.length === 0) {
      throw new Error('FallbackAIProvider requires at least one provider');
    }

    this.providers = providers;
    this.name = providers[0]!.name;
    this.defaultModel = providers[0]!.defaultModel;
    this.retryPolicy = options.retryPolicy ?? new AIRetryPolicy();
    this.healthMonitor = options.healthMonitor ?? new AIProviderHealthMonitor();
    this.metrics = options.metrics;
    this.logger = options.logger;
  }

  getCapabilities(): AICapabilities {
    return this.providers[0]!.getCapabilities();
  }

  validateConfig(): boolean {
    return this.providers[0]!.validateConfig();
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    let lastError: unknown;

    for (const provider of this.providers) {
      if (!this.healthMonitor.isAvailable(provider.name)) {
        this.logger?.warn('Skipping unhealthy AI provider', { provider: provider.name });
        continue;
      }

      try {
        return await this.retryPolicy.execute(() => this.completeWithObservability(provider, request));
      } catch (error) {
        lastError = error;
        const retryable = error instanceof AIError && error.retryable;
        if (!retryable) {
          throw error;
        }
        // else: retry budget for this provider is spent, fall through to the next one.
      }
    }

    if (lastError) throw lastError;

    throw new AIError({
      type: AIErrorType.PROVIDER_ERROR,
      message: 'All AI providers in the fallback chain are currently unhealthy',
      provider: this.name,
      retryable: true,
    });
  }

  private async completeWithObservability(provider: AIProvider, request: AIRequest): Promise<AIResponse> {
    const tags = { provider: provider.name };
    this.metrics?.incrementCounter(AI_METRICS.REQUEST_STARTED, 1, tags);
    const start = Date.now();

    try {
      const response = await provider.complete(request);
      const latencyMs = Date.now() - start;
      const responseTags = { provider: provider.name, model: response.model };

      this.healthMonitor.recordSuccess(provider.name, latencyMs);
      this.metrics?.incrementCounter(AI_METRICS.REQUEST_COMPLETED, 1, responseTags);
      this.metrics?.incrementCounter(AI_METRICS.PROVIDER_SUCCESS, 1, tags);
      this.metrics?.recordHistogram(AI_METRICS.REQUEST_DURATION, latencyMs, responseTags);
      this.metrics?.recordHistogram(AI_METRICS.PROVIDER_LATENCY, latencyMs, tags);
      this.metrics?.recordHistogram(AI_METRICS.TOKENS_PROMPT, response.usage.promptTokens, responseTags);
      this.metrics?.recordHistogram(AI_METRICS.TOKENS_COMPLETION, response.usage.completionTokens, responseTags);
      this.metrics?.recordHistogram(AI_METRICS.TOKENS_TOTAL, response.usage.totalTokens, responseTags);

      return response;
    } catch (error) {
      this.healthMonitor.recordFailure(provider.name);
      this.metrics?.incrementCounter(AI_METRICS.REQUEST_FAILED, 1, tags);
      this.metrics?.incrementCounter(AI_METRICS.PROVIDER_FAILURE, 1, tags);
      this.logger?.error('AI provider call failed', error instanceof Error ? error : undefined, {
        provider: provider.name,
      });
      throw error;
    }
  }
}

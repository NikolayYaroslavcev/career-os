import type { AIProvider, AIProviderConfig } from '../domain/ai-provider.js';
import type { AIMetricsCollector } from '../observability/ai-metrics.js';
import type { AILogger } from '../observability/ai-logger.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import { GroqProvider } from './groq-provider.js';
import { DeepSeekProvider } from './deepseek-provider.js';
import { FallbackAIProvider } from './fallback-ai-provider.js';
import { AIRetryPolicy } from '../resilience/retry-policy.js';
import { AIProviderHealthMonitor } from '../resilience/health-monitor.js';
import { AIConcurrencyLimiter } from '../resilience/concurrency-limiter.js';

export type SupportedAIProviderName = 'openai' | 'anthropic' | 'groq' | 'gemini' | 'openrouter' | 'deepseek';

export const SUPPORTED_AI_PROVIDER_NAMES: readonly SupportedAIProviderName[] = [
  'openai',
  'anthropic',
  'groq',
  'gemini',
  'openrouter',
  'deepseek',
];

export interface CreateAIProviderInput {
  readonly provider: SupportedAIProviderName;
  readonly config: AIProviderConfig;
}

/**
 * Single place that maps a provider name to its implementation. Adding a new
 * provider (e.g. a future vendor) only requires a case here — every caller
 * (apps/backend, apps/worker) gets it for free instead of re-implementing its
 * own switch statement.
 */
export function createAIProviderFromConfig(input: CreateAIProviderInput): AIProvider {
  switch (input.provider) {
    case 'anthropic':
      return new AnthropicProvider(input.config);
    case 'groq':
      return new GroqProvider(input.config);
    case 'gemini':
      return new GeminiProvider(input.config);
    case 'openrouter':
      return new OpenRouterProvider(input.config);
    case 'deepseek':
      return new DeepSeekProvider(input.config);
    case 'openai':
    default:
      return new OpenAIProvider(input.config);
  }
}

export function isSupportedAIProviderName(value: string): value is SupportedAIProviderName {
  return (SUPPORTED_AI_PROVIDER_NAMES as readonly string[]).includes(value);
}

/** Falls back to 'openai' for unset/unrecognized values — matches the historical default. */
export function resolveAIProviderName(value: string | undefined): SupportedAIProviderName {
  return value !== undefined && isSupportedAIProviderName(value) ? value : 'openai';
}

/**
 * Structural subset of `@careeros/shared`'s `Config` this module needs. Kept
 * as a local interface (rather than importing `Config`) so `@careeros/ai`
 * doesn't take on a dependency on `@careeros/shared` just for provider
 * resolution — any object with these fields (the real `Config`, a test
 * fixture, etc.) satisfies it structurally.
 */
export interface AIProviderEnvConfig {
  readonly AI_PROVIDER?: string;
  readonly AI_MODEL?: string;
  readonly AI_TIMEOUT_MS?: number;
  readonly AI_FALLBACK_PROVIDERS?: string;
  readonly AI_MAX_CONCURRENCY?: number;
  readonly OPENAI_API_KEY?: string;
  readonly ANTHROPIC_API_KEY?: string;
  readonly GROQ_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
  readonly OPENROUTER_API_KEY?: string;
  readonly DEEPSEEK_API_KEY?: string;
}

export function resolveAIProviderApiKey(provider: SupportedAIProviderName, config: AIProviderEnvConfig): string {
  switch (provider) {
    case 'anthropic':
      return config.ANTHROPIC_API_KEY ?? '';
    case 'groq':
      return config.GROQ_API_KEY ?? '';
    case 'gemini':
      return config.GEMINI_API_KEY ?? '';
    case 'openrouter':
      return config.OPENROUTER_API_KEY ?? '';
    case 'deepseek':
      return config.DEEPSEEK_API_KEY ?? '';
    case 'openai':
    default:
      return config.OPENAI_API_KEY ?? '';
  }
}

/**
 * Builds the ordered provider-name chain: the primary first, then
 * AI_FALLBACK_PROVIDERS' entries (comma-separated), skipping unrecognized
 * names, duplicates, and the primary itself if it's repeated in the list.
 */
export function resolveAIProviderChain(
  primary: SupportedAIProviderName,
  fallbackList: string | undefined
): readonly SupportedAIProviderName[] {
  const seen = new Set<SupportedAIProviderName>([primary]);
  const fallbacks: SupportedAIProviderName[] = [];

  for (const raw of (fallbackList ?? '').split(',')) {
    const name = raw.trim();
    if (!name || !isSupportedAIProviderName(name) || seen.has(name)) continue;
    seen.add(name);
    fallbacks.push(name);
  }

  return [primary, ...fallbacks];
}

export interface AIProviderRuntimeDeps {
  readonly metrics?: AIMetricsCollector;
  readonly logger?: AILogger;
  readonly retryPolicy?: AIRetryPolicy;
  readonly healthMonitor?: AIProviderHealthMonitor;
  readonly concurrencyLimiter?: AIConcurrencyLimiter;
}

/**
 * The one source of truth for turning env-shaped config into a ready-to-use
 * primary `AIProvider` — resolves provider name, API key, model override, and
 * timeout override, builds the AI_FALLBACK_PROVIDERS chain, and wraps it all
 * in a FallbackAIProvider (retry + health tracking + metrics, on by default
 * even for a single-provider chain — see FallbackAIProvider).
 *
 * Shared between apps/backend and apps/worker instead of each app re-deriving
 * this mapping itself.
 */
export function createPrimaryAIProviderFromEnv(
  config: AIProviderEnvConfig,
  deps: AIProviderRuntimeDeps = {}
): AIProvider {
  const primary = resolveAIProviderName(config.AI_PROVIDER);
  const chain = resolveAIProviderChain(primary, config.AI_FALLBACK_PROVIDERS);

  const providers = chain
    .map((name) =>
      createAIProviderFromConfig({
        provider: name,
        config: {
          apiKey: resolveAIProviderApiKey(name, config),
          // AI_MODEL only applies to the primary — model IDs aren't portable
          // across vendors (e.g. OpenRouter needs "anthropic/claude-...").
          model: name === primary ? config.AI_MODEL : undefined,
          timeoutMs: config.AI_TIMEOUT_MS,
        },
      })
    )
    // Drop unconfigured fallbacks (missing API key) rather than including a
    // provider that would fail every call; always keep the primary, even if
    // unconfigured, matching historical behavior (it just fails at call time).
    .filter((provider, index) => index === 0 || provider.validateConfig());

  return new FallbackAIProvider(providers, {
    ...deps,
    concurrencyLimiter: deps.concurrencyLimiter ?? new AIConcurrencyLimiter(config.AI_MAX_CONCURRENCY),
  });
}

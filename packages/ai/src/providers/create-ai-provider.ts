import type { AIProvider, AIProviderConfig } from '../domain/ai-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import { GroqProvider } from './groq-provider.js';

export type SupportedAIProviderName = 'openai' | 'anthropic' | 'groq' | 'gemini' | 'openrouter';

export const SUPPORTED_AI_PROVIDER_NAMES: readonly SupportedAIProviderName[] = [
  'openai',
  'anthropic',
  'groq',
  'gemini',
  'openrouter',
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
  readonly OPENAI_API_KEY?: string;
  readonly ANTHROPIC_API_KEY?: string;
  readonly GROQ_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
  readonly OPENROUTER_API_KEY?: string;
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
    case 'openai':
    default:
      return config.OPENAI_API_KEY ?? '';
  }
}

/**
 * The one source of truth for turning env-shaped config into a ready-to-use
 * primary `AIProvider` — resolves provider name, API key, model override, and
 * timeout override in one place instead of each app re-deriving them.
 */
export function createPrimaryAIProviderFromEnv(config: AIProviderEnvConfig): AIProvider {
  const provider = resolveAIProviderName(config.AI_PROVIDER);
  return createAIProviderFromConfig({
    provider,
    config: {
      apiKey: resolveAIProviderApiKey(provider, config),
      model: config.AI_MODEL,
      timeoutMs: config.AI_TIMEOUT_MS,
    },
  });
}

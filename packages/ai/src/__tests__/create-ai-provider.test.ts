import { describe, it, expect } from 'vitest';
import {
  createAIProviderFromConfig,
  createPrimaryAIProviderFromEnv,
  resolveAIProviderName,
  resolveAIProviderApiKey,
  resolveAIProviderChain,
  isSupportedAIProviderName,
  SUPPORTED_AI_PROVIDER_NAMES,
} from '../providers/create-ai-provider.js';
import { FallbackAIProvider } from '../providers/fallback-ai-provider.js';
import { OpenAIProvider } from '../providers/openai-provider.js';
import { AnthropicProvider } from '../providers/anthropic-provider.js';
import { GeminiProvider } from '../providers/gemini-provider.js';
import { OpenRouterProvider } from '../providers/openrouter-provider.js';
import { GroqProvider } from '../providers/groq-provider.js';

describe('isSupportedAIProviderName / resolveAIProviderName', () => {
  it('recognizes every implemented provider name', () => {
    for (const name of SUPPORTED_AI_PROVIDER_NAMES) {
      expect(isSupportedAIProviderName(name)).toBe(true);
    }
  });

  it('rejects unknown names', () => {
    expect(isSupportedAIProviderName('unknown-provider')).toBe(false);
  });

  it('resolves a known name unchanged', () => {
    expect(resolveAIProviderName('anthropic')).toBe('anthropic');
  });

  it('defaults to openai for unset config', () => {
    expect(resolveAIProviderName(undefined)).toBe('openai');
  });

  it('defaults to openai for an unrecognized value', () => {
    expect(resolveAIProviderName('unknown')).toBe('openai');
  });
});

describe('resolveAIProviderApiKey', () => {
  it('picks the matching env var for each of the five providers', () => {
    const config = {
      OPENAI_API_KEY: 'sk-openai',
      ANTHROPIC_API_KEY: 'sk-anthropic',
      GROQ_API_KEY: 'sk-groq',
      GEMINI_API_KEY: 'sk-gemini',
      OPENROUTER_API_KEY: 'sk-openrouter',
    };

    expect(resolveAIProviderApiKey('openai', config)).toBe('sk-openai');
    expect(resolveAIProviderApiKey('anthropic', config)).toBe('sk-anthropic');
    expect(resolveAIProviderApiKey('groq', config)).toBe('sk-groq');
    expect(resolveAIProviderApiKey('gemini', config)).toBe('sk-gemini');
    expect(resolveAIProviderApiKey('openrouter', config)).toBe('sk-openrouter');
  });

  it('returns an empty string when the matching key is unset', () => {
    expect(resolveAIProviderApiKey('gemini', {})).toBe('');
  });
});

describe('createAIProviderFromConfig', () => {
  it('constructs the concrete class matching each provider name', () => {
    expect(createAIProviderFromConfig({ provider: 'openai', config: { apiKey: 'k' } })).toBeInstanceOf(OpenAIProvider);
    expect(createAIProviderFromConfig({ provider: 'anthropic', config: { apiKey: 'k' } })).toBeInstanceOf(AnthropicProvider);
    expect(createAIProviderFromConfig({ provider: 'groq', config: { apiKey: 'k' } })).toBeInstanceOf(GroqProvider);
    expect(createAIProviderFromConfig({ provider: 'gemini', config: { apiKey: 'k' } })).toBeInstanceOf(GeminiProvider);
    expect(createAIProviderFromConfig({ provider: 'openrouter', config: { apiKey: 'k' } })).toBeInstanceOf(OpenRouterProvider);
  });
});

describe('resolveAIProviderChain', () => {
  it('is just the primary when no fallback list is given', () => {
    expect(resolveAIProviderChain('openai', undefined)).toEqual(['openai']);
    expect(resolveAIProviderChain('openai', '')).toEqual(['openai']);
  });

  it('appends fallbacks in order, skipping unknown names', () => {
    expect(resolveAIProviderChain('anthropic', 'openrouter,bogus,openai,gemini')).toEqual([
      'anthropic',
      'openrouter',
      'openai',
      'gemini',
    ]);
  });

  it('dedupes and drops the primary if it also appears in the fallback list', () => {
    expect(resolveAIProviderChain('openai', 'openai,groq,groq')).toEqual(['openai', 'groq']);
  });
});

describe('createPrimaryAIProviderFromEnv', () => {
  // The result is always a FallbackAIProvider (even a one-element chain) so
  // retry/health/metrics apply uniformly; it reports the primary's identity,
  // so behaves as a drop-in replacement for the previously bare provider.
  it('preserves historical behavior: unset AI_PROVIDER defaults to OpenAI with no model/timeout override', () => {
    const provider = createPrimaryAIProviderFromEnv({});
    expect(provider).toBeInstanceOf(FallbackAIProvider);
    expect(provider.name).toBe('openai');
    expect(provider.defaultModel).toBe('gpt-4o');
  });

  it('resolves the API key from the matching env var for the selected provider', () => {
    const provider = createPrimaryAIProviderFromEnv({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test' });
    expect(provider.name).toBe('anthropic');
    expect(provider.validateConfig()).toBe(true);
  });

  it('threads AI_MODEL through to the selected provider as a defaultModel override', () => {
    const provider = createPrimaryAIProviderFromEnv({
      AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      AI_MODEL: 'claude-sonnet-4-5',
    });
    expect(provider.defaultModel).toBe('claude-sonnet-4-5');
  });

  it('supports gemini and openrouter, previously unreachable via env config', () => {
    const gemini = createPrimaryAIProviderFromEnv({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'sk-gemini-test' });
    expect(gemini.name).toBe('gemini');
    expect(gemini.validateConfig()).toBe(true);

    const openrouter = createPrimaryAIProviderFromEnv({ AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or-test' });
    expect(openrouter.name).toBe('openrouter');
    expect(openrouter.validateConfig()).toBe(true);
  });

  it('builds a fallback chain from AI_FALLBACK_PROVIDERS and drops unconfigured fallbacks', () => {
    const provider = createPrimaryAIProviderFromEnv({
      AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      // openrouter has no API key set below, so it should be dropped from the chain.
      AI_FALLBACK_PROVIDERS: 'openrouter,openai',
      OPENAI_API_KEY: 'sk-openai-test',
    });

    expect(provider.name).toBe('anthropic');
    expect(provider).toBeInstanceOf(FallbackAIProvider);
  });

  it('keeps the primary even when unconfigured, matching historical behavior', () => {
    const provider = createPrimaryAIProviderFromEnv({ AI_PROVIDER: 'unknown' });
    expect(provider.name).toBe('openai');
    expect(provider.validateConfig()).toBe(false);
  });
});

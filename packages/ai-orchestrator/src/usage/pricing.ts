import type { ModelPricing } from '@careeros/ai';

// Approximate public per-1k-token pricing, USD, as of the providers wired up in
// packages/ai/src/providers/*. Used only to estimate spend for budget
// enforcement/dashboards — not billing-accurate. Update as provider pricing changes.
const PRICING_TABLE: readonly ModelPricing[] = [
  { provider: 'openai', model: 'gpt-4o', inputCostPer1kTokens: 0.005, outputCostPer1kTokens: 0.015 },
  { provider: 'openai', model: 'gpt-4o-mini', inputCostPer1kTokens: 0.00015, outputCostPer1kTokens: 0.0006 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', inputCostPer1kTokens: 0.003, outputCostPer1kTokens: 0.015 },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', inputCostPer1kTokens: 0.0008, outputCostPer1kTokens: 0.004 },
  { provider: 'gemini', model: 'gemini-1.5-flash', inputCostPer1kTokens: 0.000075, outputCostPer1kTokens: 0.0003 },
  { provider: 'gemini', model: 'gemini-1.5-pro', inputCostPer1kTokens: 0.00125, outputCostPer1kTokens: 0.005 },
  { provider: 'groq', model: 'llama-3.1-70b-versatile', inputCostPer1kTokens: 0.00059, outputCostPer1kTokens: 0.00079 },
  { provider: 'openrouter', model: 'default', inputCostPer1kTokens: 0.001, outputCostPer1kTokens: 0.002 },
];

const DEFAULT_PRICING: Omit<ModelPricing, 'provider' | 'model'> = {
  inputCostPer1kTokens: 0.001,
  outputCostPer1kTokens: 0.002,
};

export function getModelPricing(provider: string, model: string): ModelPricing {
  const exact = PRICING_TABLE.find((p) => p.provider === provider && p.model === model);
  if (exact) return exact;

  const providerDefault = PRICING_TABLE.find((p) => p.provider === provider);
  if (providerDefault) return { ...providerDefault, model };

  return { provider, model, ...DEFAULT_PRICING };
}

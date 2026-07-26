import { createHash } from 'node:crypto';
import type { AIFeature } from '../orchestrator-config.js';

export interface CacheKeyInput {
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly feature: AIFeature;
  readonly contentHash: string;
  readonly userId?: string;
}

export function buildCacheKey(input: CacheKeyInput): string {
  const parts = [
    input.provider,
    input.model,
    input.promptVersion,
    input.feature,
    input.contentHash,
    input.userId ?? '',
  ].join(':');

  return createHash('sha256').update(parts).digest('hex');
}

export function buildInputHash(data: Record<string, unknown>): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});

  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

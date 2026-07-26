import { toJsonInput } from '../json.js';

export interface AICacheData {
  id: string;
  cacheKey: string;
  provider: string;
  model: string;
  promptVersion: string;
  feature: string;
  response: unknown;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  hitCount: number;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
}

export interface CreateAICacheInput {
  cacheKey: string;
  provider: string;
  model: string;
  promptVersion: string;
  feature: string;
  response: unknown;
  tokensIn?: number;
  tokensOut?: number;
  estimatedCost?: number;
  ttlMs?: number;
}

export class AICacheMapper {
  static toDomain(record: AICacheData): AICacheData {
    return {
      id: record.id,
      cacheKey: record.cacheKey,
      provider: record.provider,
      model: record.model,
      promptVersion: record.promptVersion,
      feature: record.feature,
      response: record.response,
      tokensIn: record.tokensIn,
      tokensOut: record.tokensOut,
      estimatedCost: record.estimatedCost,
      hitCount: record.hitCount,
      createdAt: record.createdAt,
      lastAccessedAt: record.lastAccessedAt,
      expiresAt: record.expiresAt,
    };
  }

  static toCreateInput(input: CreateAICacheInput): {
    cacheKey: string;
    provider: string;
    model: string;
    promptVersion: string;
    feature: string;
    response: ReturnType<typeof toJsonInput>;
    tokensIn: number;
    tokensOut: number;
    estimatedCost: number;
    hitCount: number;
    createdAt: Date;
    lastAccessedAt: Date;
    expiresAt: Date;
  } {
    const ttlMs = input.ttlMs ?? 24 * 60 * 60 * 1000; // 24h default
    const now = new Date();
    return {
      cacheKey: input.cacheKey,
      provider: input.provider,
      model: input.model,
      promptVersion: input.promptVersion,
      feature: input.feature,
      response: toJsonInput(input.response),
      tokensIn: input.tokensIn ?? 0,
      tokensOut: input.tokensOut ?? 0,
      estimatedCost: input.estimatedCost ?? 0,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
    };
  }
}

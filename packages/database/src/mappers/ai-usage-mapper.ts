export interface AIUsageData {
  id: string;
  userId: string;
  jobId: string | null;
  provider: string;
  model: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  cacheHit: boolean;
  cacheMiss: boolean;
  createdAt: Date;
}

export interface CreateAIUsageInput {
  userId: string;
  jobId?: string;
  provider: string;
  model: string;
  feature: string;
  tokensIn?: number;
  tokensOut?: number;
  totalTokens?: number;
  estimatedCost?: number;
  latencyMs?: number;
  cacheHit?: boolean;
  cacheMiss?: boolean;
}

export class AIUsageMapper {
  static toDomain(record: AIUsageData): AIUsageData {
    return {
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      provider: record.provider,
      model: record.model,
      feature: record.feature,
      tokensIn: record.tokensIn,
      tokensOut: record.tokensOut,
      totalTokens: record.totalTokens,
      estimatedCost: record.estimatedCost,
      latencyMs: record.latencyMs,
      cacheHit: record.cacheHit,
      cacheMiss: record.cacheMiss,
      createdAt: record.createdAt,
    };
  }

  static toCreateInput(input: CreateAIUsageInput): {
    userId: string;
    jobId: string | null;
    provider: string;
    model: string;
    feature: string;
    tokensIn: number;
    tokensOut: number;
    totalTokens: number;
    estimatedCost: number;
    latencyMs: number;
    cacheHit: boolean;
    cacheMiss: boolean;
  } {
    return {
      userId: input.userId,
      jobId: input.jobId ?? null,
      provider: input.provider,
      model: input.model,
      feature: input.feature,
      tokensIn: input.tokensIn ?? 0,
      tokensOut: input.tokensOut ?? 0,
      totalTokens: input.totalTokens ?? 0,
      estimatedCost: input.estimatedCost ?? 0,
      latencyMs: input.latencyMs ?? 0,
      cacheHit: input.cacheHit ?? false,
      cacheMiss: input.cacheMiss ?? false,
    };
  }
}

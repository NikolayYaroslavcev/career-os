import { toNullableJsonInput } from '../json.js';

export interface AIJobData {
  id: string;
  userId: string;
  feature: string;
  status: string;
  priority: number;
  inputHash: string;
  cacheKey: string | null;
  provider: string | null;
  model: string | null;
  input: unknown;
  result: unknown;
  error: string | null;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number | null;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  vacancyId: string | null;
  applicationId: string | null;
}

export interface CreateAIJobInput {
  userId: string;
  feature: string;
  inputHash: string;
  cacheKey?: string;
  priority?: number;
  input?: unknown;
  maxRetries?: number;
}

export interface UpdateAIJobInput {
  status?: string;
  provider?: string;
  model?: string;
  result?: unknown;
  error?: string;
  tokensIn?: number;
  tokensOut?: number;
  totalTokens?: number;
  estimatedCost?: number;
  latencyMs?: number;
  retryCount?: number;
  startedAt?: Date;
  completedAt?: Date;
  vacancyId?: string;
  applicationId?: string;
}

export class AIJobMapper {
  static toDomain(record: AIJobData): AIJobData {
    return {
      id: record.id,
      userId: record.userId,
      feature: record.feature,
      status: record.status,
      priority: record.priority,
      inputHash: record.inputHash,
      cacheKey: record.cacheKey,
      provider: record.provider,
      model: record.model,
      input: record.input,
      result: record.result,
      error: record.error,
      tokensIn: record.tokensIn,
      tokensOut: record.tokensOut,
      totalTokens: record.totalTokens,
      estimatedCost: record.estimatedCost,
      latencyMs: record.latencyMs,
      retryCount: record.retryCount,
      maxRetries: record.maxRetries,
      createdAt: record.createdAt,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      vacancyId: record.vacancyId,
      applicationId: record.applicationId,
    };
  }

  static toCreateInput(input: CreateAIJobInput): {
    userId: string;
    feature: string;
    inputHash: string;
    cacheKey: string | null;
    priority: number;
    input: ReturnType<typeof toNullableJsonInput>;
    maxRetries: number;
  } {
    return {
      userId: input.userId,
      feature: input.feature,
      inputHash: input.inputHash,
      cacheKey: input.cacheKey ?? null,
      priority: input.priority ?? 0,
      input: toNullableJsonInput(input.input),
      maxRetries: input.maxRetries ?? 3,
    };
  }

  static toUpdateInput(input: UpdateAIJobInput): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.provider !== undefined) data.provider = input.provider;
    if (input.model !== undefined) data.model = input.model;
    if (input.result !== undefined) data.result = toNullableJsonInput(input.result);
    if (input.error !== undefined) data.error = input.error;
    if (input.tokensIn !== undefined) data.tokensIn = input.tokensIn;
    if (input.tokensOut !== undefined) data.tokensOut = input.tokensOut;
    if (input.totalTokens !== undefined) data.totalTokens = input.totalTokens;
    if (input.estimatedCost !== undefined) data.estimatedCost = input.estimatedCost;
    if (input.latencyMs !== undefined) data.latencyMs = input.latencyMs;
    if (input.retryCount !== undefined) data.retryCount = input.retryCount;
    if (input.startedAt !== undefined) data.startedAt = input.startedAt;
    if (input.completedAt !== undefined) data.completedAt = input.completedAt;
    if (input.vacancyId !== undefined) data.vacancyId = input.vacancyId;
    if (input.applicationId !== undefined) data.applicationId = input.applicationId;
    return data;
  }
}

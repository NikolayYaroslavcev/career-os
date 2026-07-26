import type { AIBudgetPeriod } from '@prisma/client';
import { prisma } from '../client.js';
import { toNullableJsonInput } from '../json.js';

export interface AIBudgetData {
  id: string;
  userId: string | null;
  period: string;
  maxTokens: number | null;
  maxCost: number | null;
  maxRequestsPerFeature: unknown;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAIBudgetInput {
  userId?: string;
  period: 'DAILY' | 'MONTHLY';
  maxTokens?: number;
  maxCost?: number;
  maxRequestsPerFeature?: Record<string, number>;
  isEnabled?: boolean;
}

export interface UpdateAIBudgetInput {
  maxTokens?: number;
  maxCost?: number;
  maxRequestsPerFeature?: Record<string, number>;
  isEnabled?: boolean;
}

export interface AIBudgetRepository {
  upsert(input: CreateAIBudgetInput): Promise<AIBudgetData>;
  findByUserAndPeriod(userId: string, period: string): Promise<AIBudgetData | null>;
  findGlobalByPeriod(period: string): Promise<AIBudgetData | null>;
  update(id: string, input: UpdateAIBudgetInput): Promise<void>;
}

export class PrismaAIBudgetRepository implements AIBudgetRepository {
  async upsert(input: CreateAIBudgetInput): Promise<AIBudgetData> {
    const record = await prisma.aIBudget.upsert({
      where: {
        userId_period: {
          userId: input.userId ?? '',
          period: input.period,
        },
      },
      create: {
        userId: input.userId ?? null,
        period: input.period as AIBudgetPeriod,
        maxTokens: input.maxTokens ?? null,
        maxCost: input.maxCost ?? null,
        maxRequestsPerFeature: toNullableJsonInput(input.maxRequestsPerFeature ?? null),
        isEnabled: input.isEnabled ?? true,
      },
      update: {
        maxTokens: input.maxTokens ?? undefined,
        maxCost: input.maxCost ?? undefined,
        maxRequestsPerFeature: input.maxRequestsPerFeature !== undefined
          ? toNullableJsonInput(input.maxRequestsPerFeature)
          : undefined,
        isEnabled: input.isEnabled ?? undefined,
      },
    });
    return record;
  }

  async findByUserAndPeriod(userId: string, period: string): Promise<AIBudgetData | null> {
    return prisma.aIBudget.findUnique({
      where: { userId_period: { userId, period: period as AIBudgetPeriod } },
    });
  }

  async findGlobalByPeriod(period: string): Promise<AIBudgetData | null> {
    return prisma.aIBudget.findFirst({
      where: { userId: null, period: period as AIBudgetPeriod },
    });
  }

  async update(id: string, input: UpdateAIBudgetInput): Promise<void> {
    const data: Record<string, unknown> = {};
    if (input.maxTokens !== undefined) data.maxTokens = input.maxTokens;
    if (input.maxCost !== undefined) data.maxCost = input.maxCost;
    if (input.maxRequestsPerFeature !== undefined) data.maxRequestsPerFeature = toNullableJsonInput(input.maxRequestsPerFeature);
    if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
    await prisma.aIBudget.update({ where: { id }, data });
  }
}

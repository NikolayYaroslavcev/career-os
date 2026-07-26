import { prisma } from '../client.js';
import {
  CareerInsightMapper,
  type CareerInsightData,
  type UpsertCareerInsightInput,
} from '../mappers/career-insight-mapper.js';

export interface CareerInsightRepository {
  /** Latest cached insight of this type for the user, or null if never computed. */
  get(userId: string, insightType: string): Promise<CareerInsightData | null>;
  /** Replaces the single cached row for (userId, insightType) — one row per type per user. */
  upsert(input: UpsertCareerInsightInput): Promise<void>;
}

export class PrismaCareerInsightRepository implements CareerInsightRepository {
  async get(userId: string, insightType: string): Promise<CareerInsightData | null> {
    const record = await prisma.careerInsight.findUnique({
      where: { userId_insightType: { userId, insightType } },
    });

    return record ? CareerInsightMapper.toDomain(record) : null;
  }

  async upsert(input: UpsertCareerInsightInput): Promise<void> {
    await prisma.careerInsight.upsert({
      where: { userId_insightType: { userId: input.userId, insightType: input.insightType } },
      create: {
        userId: input.userId,
        insightType: input.insightType,
        data: input.data as never,
        validUntil: input.validUntil,
      },
      update: {
        data: input.data as never,
        validUntil: input.validUntil,
        computedAt: new Date(),
      },
    });
  }
}

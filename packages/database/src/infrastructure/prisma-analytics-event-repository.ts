import { prisma } from '../client.js';
import {
  AnalyticsEventMapper,
  type AnalyticsEventData,
  type RecordAnalyticsEventInput,
} from '../mappers/analytics-event-mapper.js';

export interface AnalyticsEventQueryOptions {
  eventType?: string;
  entityType?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}

export interface AnalyticsEventRepository {
  record(input: RecordAnalyticsEventInput): Promise<void>;
  /** Bulk insert for high-volume events (e.g. one 'vacancy_found' per search result) — a single round trip instead of N. */
  recordMany(inputs: readonly RecordAnalyticsEventInput[]): Promise<void>;
  findByUserId(userId: string, options?: AnalyticsEventQueryOptions): Promise<AnalyticsEventData[]>;
  /** Count of distinct entityIds for a given userId/eventType — used e.g. for "distinct vacancies found" in a period, without loading every row. */
  countDistinctEntities(userId: string, eventType: string, options?: { since?: Date; until?: Date }): Promise<number>;
}

export class PrismaAnalyticsEventRepository implements AnalyticsEventRepository {
  async record(input: RecordAnalyticsEventInput): Promise<void> {
    const data = AnalyticsEventMapper.toCreateInput(input);
    await prisma.analyticsEvent.create({ data });
  }

  async recordMany(inputs: readonly RecordAnalyticsEventInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await prisma.analyticsEvent.createMany({
      data: inputs.map((input) => AnalyticsEventMapper.toCreateInput(input)),
    });
  }

  async findByUserId(userId: string, options?: AnalyticsEventQueryOptions): Promise<AnalyticsEventData[]> {
    const where: Record<string, unknown> = { userId };
    if (options?.eventType) where.eventType = options.eventType;
    if (options?.entityType) where.entityType = options.entityType;
    if (options?.since || options?.until) {
      where.occurredAt = {
        ...(options?.since ? { gte: options.since } : {}),
        ...(options?.until ? { lte: options.until } : {}),
      };
    }

    const records = await prisma.analyticsEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: options?.limit ?? 1000,
    });

    return records.map(AnalyticsEventMapper.toDomain);
  }

  async countDistinctEntities(
    userId: string,
    eventType: string,
    options?: { since?: Date; until?: Date }
  ): Promise<number> {
    const where: Record<string, unknown> = { userId, eventType };
    if (options?.since || options?.until) {
      where.occurredAt = {
        ...(options?.since ? { gte: options.since } : {}),
        ...(options?.until ? { lte: options.until } : {}),
      };
    }

    const groups = await prisma.analyticsEvent.groupBy({
      by: ['entityId'],
      where,
    });

    return groups.length;
  }
}

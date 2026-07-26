import { toJsonInput } from '../json.js';

export interface AnalyticsEventData {
  id: string;
  userId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

export interface RecordAnalyticsEventInput {
  userId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

interface AnalyticsEventRow {
  id: string;
  userId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  occurredAt: Date;
}

export class AnalyticsEventMapper {
  static toDomain(record: AnalyticsEventRow): AnalyticsEventData {
    return {
      id: record.id,
      userId: record.userId,
      eventType: record.eventType,
      entityType: record.entityType,
      entityId: record.entityId,
      metadata: (record.metadata as Record<string, unknown> | null) ?? {},
      occurredAt: record.occurredAt,
    };
  }

  static toCreateInput(input: RecordAnalyticsEventInput): {
    userId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    metadata: ReturnType<typeof toJsonInput>;
  } {
    return {
      userId: input.userId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: toJsonInput(input.metadata ?? {}),
    };
  }
}

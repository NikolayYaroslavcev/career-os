export interface CareerInsightData {
  id: string;
  userId: string;
  insightType: string;
  data: unknown;
  computedAt: Date;
  validUntil: Date | null;
}

export interface UpsertCareerInsightInput {
  userId: string;
  insightType: string;
  data: unknown;
  validUntil: Date | null;
}

interface CareerInsightRow {
  id: string;
  userId: string;
  insightType: string;
  data: unknown;
  computedAt: Date;
  validUntil: Date | null;
}

export class CareerInsightMapper {
  static toDomain(record: CareerInsightRow): CareerInsightData {
    return {
      id: record.id,
      userId: record.userId,
      insightType: record.insightType,
      data: record.data,
      computedAt: record.computedAt,
      validUntil: record.validUntil,
    };
  }
}

import type {
  DiscoverySourceConfigData,
  DiscoverySourceConfigRepository,
  DiscoverySourceId,
  DiscoverySourceRunStatus,
} from '@careeros/discovery-sources';
import { prisma } from '../client.js';
import { toNullableJsonInput } from '../json.js';

interface DiscoverySourceRow {
  id: string;
  sourceId: string;
  enabled: boolean;
  cursor: unknown;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  candidatesFound: number;
  candidatesEnrolled: number;
  candidatesRejected: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaDiscoverySourceRepository implements DiscoverySourceConfigRepository {
  async findBySourceId(sourceId: DiscoverySourceId): Promise<DiscoverySourceConfigData | null> {
    const record = await prisma.discoverySource.findUnique({ where: { sourceId } });
    return record ? this.toDomain(record) : null;
  }

  async findAllEnabled(): Promise<readonly DiscoverySourceConfigData[]> {
    const records = await prisma.discoverySource.findMany({ where: { enabled: true }, orderBy: { sourceId: 'asc' } });
    return records.map((r) => this.toDomain(r));
  }

  async findAll(): Promise<readonly DiscoverySourceConfigData[]> {
    const records = await prisma.discoverySource.findMany({ orderBy: { sourceId: 'asc' } });
    return records.map((r) => this.toDomain(r));
  }

  async ensureRegistered(sourceId: DiscoverySourceId): Promise<DiscoverySourceConfigData> {
    const record = await prisma.discoverySource.upsert({
      where: { sourceId },
      update: {},
      create: { sourceId, enabled: true },
    });
    return this.toDomain(record);
  }

  async update(data: DiscoverySourceConfigData): Promise<DiscoverySourceConfigData> {
    const record = await prisma.discoverySource.update({
      where: { sourceId: data.sourceId },
      data: {
        enabled: data.enabled,
        cursor: toNullableJsonInput(data.cursor ?? null),
        lastRunAt: data.lastRunAt,
        lastRunStatus: data.lastRunStatus,
        lastRunError: data.lastRunError,
        candidatesFound: data.candidatesFound,
        candidatesEnrolled: data.candidatesEnrolled,
        candidatesRejected: data.candidatesRejected,
        metadata: toNullableJsonInput(data.metadata ?? null),
      },
    });
    return this.toDomain(record);
  }

  private toDomain(record: DiscoverySourceRow): DiscoverySourceConfigData {
    return {
      id: record.id,
      sourceId: record.sourceId as DiscoverySourceId,
      enabled: record.enabled,
      cursor: (record.cursor as DiscoverySourceConfigData['cursor']) ?? null,
      lastRunAt: record.lastRunAt,
      lastRunStatus: record.lastRunStatus as DiscoverySourceRunStatus | null,
      lastRunError: record.lastRunError,
      candidatesFound: record.candidatesFound,
      candidatesEnrolled: record.candidatesEnrolled,
      candidatesRejected: record.candidatesRejected,
      metadata: (record.metadata as Record<string, unknown> | null) ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

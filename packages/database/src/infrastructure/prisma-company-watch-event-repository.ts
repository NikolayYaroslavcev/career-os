import { prisma } from '../client.js';
import { toNullableJsonInput } from '../json.js';

export interface CompanyWatchEventData {
  id: string;
  type: 'NEW_JOB' | 'REMOVED_JOB' | 'CHANGED_JOB';
  externalId?: string;
  title?: string;
  description?: string;
  url?: string;
  location?: string;
  salary?: { min?: number; max?: number; currency?: string };
  technologies: string[];
  publishedAt?: Date;
  detectedAt: Date;
  processed: boolean;
  notifiedAt?: Date;
  metadata?: Record<string, unknown>;
  companyWatchId: string;
}

export class PrismaCompanyWatchEventRepository {
  async findById(id: string): Promise<CompanyWatchEventData | null> {
    const record = await prisma.companyWatchEvent.findUnique({
      where: { id },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async findAllByCompanyWatch(
    companyWatchId: string,
    options?: { type?: string; limit?: number; offset?: number }
  ): Promise<CompanyWatchEventData[]> {
    const records = await prisma.companyWatchEvent.findMany({
      where: {
        companyWatchId,
        ...(options?.type ? { type: options.type as 'NEW_JOB' | 'REMOVED_JOB' | 'CHANGED_JOB' } : {}),
      },
      orderBy: { detectedAt: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    });

    return records.map(this.toDomain);
  }

  async create(data: CompanyWatchEventData): Promise<CompanyWatchEventData> {
    const record = await prisma.companyWatchEvent.create({
      data: this.toPersistence(data),
    });

    return this.toDomain(record);
  }

  async update(data: CompanyWatchEventData): Promise<CompanyWatchEventData> {
    const record = await prisma.companyWatchEvent.update({
      where: { id: data.id },
      data: {
        processed: data.processed,
        notifiedAt: data.notifiedAt,
      },
    });

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await prisma.companyWatchEvent.delete({
      where: { id },
    });
  }

  async countByCompanyWatch(companyWatchId: string, type?: string, since?: Date): Promise<number> {
    return prisma.companyWatchEvent.count({
      where: {
        companyWatchId,
        ...(type ? { type: type as 'NEW_JOB' | 'REMOVED_JOB' | 'CHANGED_JOB' } : {}),
        ...(since ? { detectedAt: { gte: since } } : {}),
      },
    });
  }

  private toDomain(record: {
    id: string;
    type: 'NEW_JOB' | 'REMOVED_JOB' | 'CHANGED_JOB';
    externalId: string | null;
    title: string | null;
    description: string | null;
    url: string | null;
    location: string | null;
    salary: unknown;
    technologies: string[];
    publishedAt: Date | null;
    detectedAt: Date;
    processed: boolean;
    notifiedAt: Date | null;
    metadata: unknown;
    companyWatchId: string;
  }): CompanyWatchEventData {
    return {
      id: record.id,
      type: record.type,
      externalId: record.externalId ?? undefined,
      title: record.title ?? undefined,
      description: record.description ?? undefined,
      url: record.url ?? undefined,
      location: record.location ?? undefined,
      salary: (record.salary as { min?: number; max?: number; currency?: string }) ?? undefined,
      technologies: record.technologies,
      publishedAt: record.publishedAt ?? undefined,
      detectedAt: record.detectedAt,
      processed: record.processed,
      notifiedAt: record.notifiedAt ?? undefined,
      metadata: (record.metadata as Record<string, unknown>) ?? undefined,
      companyWatchId: record.companyWatchId,
    };
  }

  private toPersistence(data: CompanyWatchEventData): {
    type: 'NEW_JOB' | 'REMOVED_JOB' | 'CHANGED_JOB';
    externalId: string | undefined;
    title: string | undefined;
    description: string | undefined;
    url: string | undefined;
    location: string | undefined;
    salary: ReturnType<typeof toNullableJsonInput>;
    technologies: string[];
    publishedAt: Date | undefined;
    detectedAt: Date;
    processed: boolean;
    notifiedAt: Date | undefined;
    metadata: ReturnType<typeof toNullableJsonInput>;
    companyWatchId: string;
  } {
    return {
      type: data.type,
      externalId: data.externalId,
      title: data.title,
      description: data.description,
      url: data.url,
      location: data.location,
      salary: toNullableJsonInput(data.salary ?? null),
      technologies: data.technologies,
      publishedAt: data.publishedAt,
      detectedAt: data.detectedAt,
      processed: data.processed,
      notifiedAt: data.notifiedAt,
      metadata: toNullableJsonInput(data.metadata ?? null),
      companyWatchId: data.companyWatchId,
    };
  }
}

import type { CompanyWatchData, CompanyWatchRepository } from '@careeros/company-watch';
import type { AtsType } from '@prisma/client';
import { prisma } from '../client.js';
import { toNullableJsonInput } from '../json.js';

interface CompanyWatchRow {
  id: string;
  name: string;
  aliases: string[];
  country: string | null;
  languages: string[];
  tags: string[];
  atsType: string;
  careerUrl: string;
  atsEndpoint: string | null;
  pollingInterval: number;
  active: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  metadata: unknown;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaCompanyWatchRepository implements CompanyWatchRepository {
  async findById(id: string): Promise<CompanyWatchData | null> {
    const record = await prisma.companyWatch.findUnique({
      where: { id },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async findByName(workspaceId: string, name: string): Promise<CompanyWatchData | null> {
    const record = await prisma.companyWatch.findFirst({
      where: { workspaceId, name },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async findAllByWorkspace(workspaceId: string): Promise<CompanyWatchData[]> {
    const records = await prisma.companyWatch.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async findAllActive(): Promise<CompanyWatchData[]> {
    const records = await prisma.companyWatch.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async create(data: CompanyWatchData): Promise<CompanyWatchData> {
    const record = await prisma.companyWatch.create({
      data: this.toPersistence(data),
    });

    return this.toDomain(record);
  }

  async update(data: CompanyWatchData): Promise<CompanyWatchData> {
    const record = await prisma.companyWatch.update({
      where: { id: data.id },
      data: this.toPersistence(data),
    });

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await prisma.companyWatch.delete({
      where: { id },
    });
  }

  async upsert(data: {
    where: { workspaceId_name: { workspaceId: string; name: string } };
    create: Partial<CompanyWatchData>;
    update: Partial<CompanyWatchData>;
  }): Promise<CompanyWatchData> {
    const record = await prisma.companyWatch.upsert({
      where: { workspaceId_name: data.where.workspaceId_name },
      create: {
        id: crypto.randomUUID(),
        name: data.create.name ?? '',
        aliases: data.create.aliases ?? [],
        country: data.create.country,
        languages: data.create.languages ?? [],
        tags: data.create.tags ?? [],
        atsType: data.create.atsType as AtsType,
        careerUrl: data.create.careerUrl ?? '',
        atsEndpoint: data.create.atsEndpoint,
        pollingInterval: data.create.pollingInterval ?? 3600,
        active: data.create.active ?? true,
        lastSyncAt: data.create.lastSyncAt,
        lastSyncStatus: data.create.lastSyncStatus,
        lastSyncError: data.create.lastSyncError,
        metadata: toNullableJsonInput(data.create.metadata ?? null),
        workspaceId: data.where.workspaceId_name.workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        ...(data.update.name !== undefined ? { name: data.update.name } : {}),
        ...(data.update.aliases !== undefined ? { aliases: data.update.aliases } : {}),
        ...(data.update.country !== undefined ? { country: data.update.country } : {}),
        ...(data.update.languages !== undefined ? { languages: data.update.languages } : {}),
        ...(data.update.tags !== undefined ? { tags: data.update.tags } : {}),
        ...(data.update.atsType !== undefined ? { atsType: data.update.atsType as AtsType } : {}),
        ...(data.update.careerUrl !== undefined ? { careerUrl: data.update.careerUrl } : {}),
        ...(data.update.atsEndpoint !== undefined ? { atsEndpoint: data.update.atsEndpoint } : {}),
        ...(data.update.pollingInterval !== undefined ? { pollingInterval: data.update.pollingInterval } : {}),
        ...(data.update.active !== undefined ? { active: data.update.active } : {}),
        ...(data.update.lastSyncAt !== undefined ? { lastSyncAt: data.update.lastSyncAt } : {}),
        ...(data.update.lastSyncStatus !== undefined ? { lastSyncStatus: data.update.lastSyncStatus } : {}),
        ...(data.update.lastSyncError !== undefined ? { lastSyncError: data.update.lastSyncError } : {}),
        ...(data.update.metadata !== undefined ? { metadata: toNullableJsonInput(data.update.metadata) } : {}),
        updatedAt: new Date(),
      },
    });

    return this.toDomain(record);
  }

  private toDomain(record: CompanyWatchRow): CompanyWatchData {
    return {
      id: record.id,
      name: record.name,
      aliases: record.aliases,
      country: record.country ?? undefined,
      languages: record.languages,
      tags: record.tags,
      atsType: record.atsType,
      careerUrl: record.careerUrl,
      atsEndpoint: record.atsEndpoint ?? undefined,
      pollingInterval: record.pollingInterval,
      active: record.active,
      lastSyncAt: record.lastSyncAt ?? undefined,
      lastSyncStatus: record.lastSyncStatus ?? undefined,
      lastSyncError: record.lastSyncError ?? undefined,
      metadata: (record.metadata as Record<string, unknown> | null) ?? undefined,
      workspaceId: record.workspaceId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toPersistence(data: CompanyWatchData): {
    name: string;
    aliases: string[];
    country: string | undefined;
    languages: string[];
    tags: string[];
    atsType: AtsType;
    careerUrl: string;
    atsEndpoint: string | undefined;
    pollingInterval: number;
    active: boolean;
    lastSyncAt: Date | undefined;
    lastSyncStatus: string | undefined;
    lastSyncError: string | undefined;
    metadata: ReturnType<typeof toNullableJsonInput>;
    workspaceId: string;
  } {
    return {
      name: data.name,
      aliases: data.aliases,
      country: data.country,
      languages: data.languages,
      tags: data.tags,
      atsType: data.atsType as AtsType,
      careerUrl: data.careerUrl,
      atsEndpoint: data.atsEndpoint,
      pollingInterval: data.pollingInterval,
      active: data.active,
      lastSyncAt: data.lastSyncAt,
      lastSyncStatus: data.lastSyncStatus,
      lastSyncError: data.lastSyncError,
      metadata: toNullableJsonInput(data.metadata ?? null),
      workspaceId: data.workspaceId,
    };
  }
}

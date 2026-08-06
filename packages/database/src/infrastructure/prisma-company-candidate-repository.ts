import type { CompanyCandidateData, CompanyCandidateRepository, CompanyCandidateStatus } from '@careeros/company-watch';
import type { AtsType as PrismaAtsType, CompanyCandidateStatus as PrismaCompanyCandidateStatus } from '@prisma/client';
import { prisma } from '../client.js';
import { toNullableJsonInput } from '../json.js';

const ALL_CANDIDATE_STATUSES: readonly CompanyCandidateStatus[] = [
  'DISCOVERED',
  'AUTO_APPROVED',
  'REVIEW_REQUIRED',
  'REJECTED',
  'CONVERTED',
];

interface CompanyCandidateRow {
  id: string;
  companyName: string;
  careerUrl: string;
  atsType: string | null;
  atsEndpoint: string | null;
  discoverySource: string;
  confidenceScore: number | null;
  status: string;
  metadata: unknown;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  seenCount: number;
  vacancyCount: number;
  providerCount: number;
  providers: string[];
  lastVacancyTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaCompanyCandidateRepository implements CompanyCandidateRepository {
  async findById(id: string): Promise<CompanyCandidateData | null> {
    const record = await prisma.companyCandidate.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByCareerUrl(careerUrl: string): Promise<CompanyCandidateData | null> {
    const record = await prisma.companyCandidate.findFirst({ where: { careerUrl } });
    return record ? this.toDomain(record) : null;
  }

  async findByCompanyName(companyName: string): Promise<CompanyCandidateData | null> {
    const record = await prisma.companyCandidate.findFirst({
      where: {
        companyName: { equals: companyName, mode: 'insensitive' },
        status: { notIn: ['REJECTED', 'CONVERTED'] },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return record ? this.toDomain(record) : null;
  }

  async findAllByStatus(
    statuses: readonly CompanyCandidateStatus[],
    options?: { limit?: number; offset?: number }
  ): Promise<CompanyCandidateData[]> {
    const records = await prisma.companyCandidate.findMany({
      where: { status: { in: statuses as PrismaCompanyCandidateStatus[] } },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getStatusCounts(): Promise<Record<CompanyCandidateStatus, number>> {
    const grouped = await prisma.companyCandidate.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const counts = Object.fromEntries(ALL_CANDIDATE_STATUSES.map((status) => [status, 0])) as Record<
      CompanyCandidateStatus,
      number
    >;
    for (const row of grouped) {
      counts[row.status as CompanyCandidateStatus] = row._count.status;
    }
    return counts;
  }

  async create(data: CompanyCandidateData): Promise<CompanyCandidateData> {
    const record = await prisma.companyCandidate.create({ data: this.toPersistence(data) });
    return this.toDomain(record);
  }

  async update(data: CompanyCandidateData): Promise<CompanyCandidateData> {
    const record = await prisma.companyCandidate.update({
      where: { id: data.id },
      data: this.toPersistence(data),
    });
    return this.toDomain(record);
  }

  private toDomain(record: CompanyCandidateRow): CompanyCandidateData {
    return {
      id: record.id,
      companyName: record.companyName,
      careerUrl: record.careerUrl,
      atsType: (record.atsType as CompanyCandidateData['atsType']) ?? undefined,
      atsEndpoint: record.atsEndpoint ?? undefined,
      discoverySource: record.discoverySource,
      confidenceScore: record.confidenceScore ?? undefined,
      status: record.status as CompanyCandidateStatus,
      metadata: (record.metadata as Record<string, unknown> | null) ?? undefined,
      firstSeenAt: record.firstSeenAt ?? undefined,
      lastSeenAt: record.lastSeenAt ?? undefined,
      seenCount: record.seenCount,
      vacancyCount: record.vacancyCount,
      providerCount: record.providerCount,
      providers: record.providers,
      lastVacancyTitle: record.lastVacancyTitle ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toPersistence(data: CompanyCandidateData): {
    id: string;
    companyName: string;
    careerUrl: string;
    atsType: PrismaAtsType | null;
    atsEndpoint: string | null | undefined;
    discoverySource: string;
    confidenceScore: number | null | undefined;
    status: PrismaCompanyCandidateStatus;
    metadata: ReturnType<typeof toNullableJsonInput>;
    firstSeenAt: Date | null | undefined;
    lastSeenAt: Date | null | undefined;
    seenCount: number;
    vacancyCount: number;
    providerCount: number;
    providers: string[];
    lastVacancyTitle: string | null | undefined;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: data.id,
      companyName: data.companyName,
      careerUrl: data.careerUrl,
      atsType: (data.atsType as PrismaAtsType) ?? null,
      atsEndpoint: data.atsEndpoint,
      discoverySource: data.discoverySource,
      confidenceScore: data.confidenceScore,
      status: data.status as PrismaCompanyCandidateStatus,
      metadata: toNullableJsonInput(data.metadata ?? null),
      firstSeenAt: data.firstSeenAt ?? null,
      lastSeenAt: data.lastSeenAt ?? null,
      seenCount: data.seenCount,
      vacancyCount: data.vacancyCount,
      providerCount: data.providerCount,
      providers: data.providers,
      lastVacancyTitle: data.lastVacancyTitle ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

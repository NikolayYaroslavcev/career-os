import type { VacancyRepository, SaveVacancyOptions, VacancyListCriteria, VacancyListResult, VacancyStats } from '@careeros/career';
import type { VacancyId, CompanyId } from '@careeros/career';
import type { Vacancy } from '@careeros/career';
import type { Prisma } from '@prisma/client';
import { prisma } from '../client.js';
import { VacancyMapper } from '../mappers/vacancy-mapper.js';

export class PrismaVacancyRepository implements VacancyRepository {
  async findById(id: VacancyId): Promise<Vacancy | null> {
    const record = await prisma.vacancy.findUnique({ where: { id } });
    if (!record) return null;
    return VacancyMapper.toDomain(record);
  }

  async findByIdForWorkspace(id: VacancyId, workspaceId: string): Promise<Vacancy | null> {
    const record = await prisma.vacancy.findFirst({ where: { id, workspaceId } });
    if (!record) return null;
    return VacancyMapper.toDomain(record);
  }

  async findByIds(ids: readonly VacancyId[]): Promise<Vacancy[]> {
    if (ids.length === 0) return [];
    const records = await prisma.vacancy.findMany({ where: { id: { in: [...ids] } } });
    return records.map(VacancyMapper.toDomain);
  }

  async findByCompanyId(companyId: CompanyId): Promise<Vacancy[]> {
    const records = await prisma.vacancy.findMany({ where: { companyId } });
    return records.map(VacancyMapper.toDomain);
  }

  async findByTitleAndCompany(title: string, companyId: CompanyId): Promise<Vacancy | null> {
    const record = await prisma.vacancy.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        companyId,
      },
    });
    if (!record) return null;
    return VacancyMapper.toDomain(record);
  }

  async findMany(criteria: VacancyListCriteria): Promise<VacancyListResult> {
    const where: Prisma.VacancyWhereInput = { workspaceId: criteria.workspaceId };

    if (criteria.query) {
      where.OR = [
        { title: { contains: criteria.query, mode: 'insensitive' } },
        { description: { contains: criteria.query, mode: 'insensitive' } },
      ];
    }

    if (criteria.location) {
      where.location = { contains: criteria.location, mode: 'insensitive' };
    }

    if (criteria.remote) {
      where.remote = criteria.remote.toUpperCase() as Prisma.EnumRemoteTypeFilter['equals'];
    }

    if (criteria.salaryMin !== undefined) {
      where.salaryMax = { gte: criteria.salaryMin };
    }

    if (criteria.salaryMax !== undefined) {
      where.salaryMin = { lte: criteria.salaryMax };
    }

    if (criteria.company) {
      where.company = { name: { contains: criteria.company, mode: 'insensitive' } };
    }

    if (criteria.source) {
      where.sources = { some: { providerId: criteria.source } };
    }

    if (criteria.experienceLevel) {
      where.experienceLevel = criteria.experienceLevel;
    }

    if (criteria.employmentType) {
      where.employmentType = criteria.employmentType;
    }

    if (criteria.publishedAfter) {
      where.publishedAt = { gte: criteria.publishedAfter };
    }

    if (criteria.publishedBefore) {
      where.publishedAt = { ...(where.publishedAt as Prisma.DateTimeFilter ?? {}), lte: criteria.publishedBefore };
    }

    if (criteria.technology) {
      (where as Record<string, unknown>).technologies = { has: criteria.technology };
    }

    let orderBy: Prisma.VacancyOrderByWithRelationInput;
    switch (criteria.sortBy) {
      case 'salary':
        orderBy = { salaryMax: criteria.sortOrder === 'asc' ? 'asc' : 'desc' };
        break;
      case 'company':
        orderBy = { company: { name: criteria.sortOrder === 'asc' ? 'asc' : 'desc' } };
        break;
      case 'title':
        orderBy = { title: criteria.sortOrder === 'asc' ? 'asc' : 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { publishedAt: 'desc' };
        break;
    }

    const [records, total] = await Promise.all([
      prisma.vacancy.findMany({
        where,
        orderBy,
        take: criteria.limit,
        skip: criteria.offset,
      }),
      prisma.vacancy.count({ where }),
    ]);

    return { vacancies: records.map(VacancyMapper.toDomain), total };
  }

  async getStats(workspaceId: string): Promise<VacancyStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalJobs, newToday, sourceCounts, lastSync] = await Promise.all([
      prisma.vacancy.count({ where: { workspaceId } }),
      prisma.vacancy.count({ where: { workspaceId, createdAt: { gte: today } } }),
      prisma.vacancySource.groupBy({
        by: ['providerId'],
        where: { vacancy: { workspaceId } },
        _count: { providerId: true },
      }),
      prisma.vacancySource.findFirst({
        where: { vacancy: { workspaceId } },
        orderBy: { lastSeenAt: 'desc' },
        select: { lastSeenAt: true },
      }),
    ]);

    return {
      totalJobs,
      newToday,
      sources: sourceCounts.map((s) => ({ source: s.providerId, count: s._count.providerId })),
      totalSources: sourceCounts.length,
      lastSyncAt: lastSync?.lastSeenAt ?? null,
    };
  }

  async findCompaniesForVacancies(vacancyCompanyIds: string[]): Promise<Map<string, { id: string; name: string; website: string | null }>> {
    const uniqueIds = [...new Set(vacancyCompanyIds)];
    if (uniqueIds.length === 0) return new Map();

    const companies = await prisma.company.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, website: true },
    });

    const byId = new Map<string, { id: string; name: string; website: string | null }>();
    for (const c of companies) {
      byId.set(c.id, c);
    }
    return byId;
  }

  async save(vacancy: Vacancy, options: SaveVacancyOptions): Promise<void> {
    const data = VacancyMapper.toPersistence(vacancy, options.workspaceId);
    await prisma.vacancy.upsert({
      where: { id: vacancy.id },
      create: data,
      update: data,
    });
  }

  async delete(id: VacancyId): Promise<void> {
    await prisma.vacancy.delete({ where: { id } });
  }

  async exists(id: VacancyId): Promise<boolean> {
    const count = await prisma.vacancy.count({ where: { id } });
    return count > 0;
  }
}

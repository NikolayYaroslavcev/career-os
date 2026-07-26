import { prisma } from '../client.js';

export interface QualityDataRecord {
  sourceUrl: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  location: string | null;
}

export interface QualityDataRepository {
  findSourcesWithVacancies(providerId: string): Promise<QualityDataRecord[]>;
  countDistinctCompaniesByProvider(providerId: string): Promise<number>;
}

export class PrismaQualityDataRepository implements QualityDataRepository {
  async findSourcesWithVacancies(providerId: string): Promise<QualityDataRecord[]> {
    const sources = await prisma.vacancySource.findMany({
      where: { providerId },
      include: { vacancy: { select: { salaryMin: true, salaryMax: true, location: true } } },
    });

    return sources.map((s) => ({
      sourceUrl: s.sourceUrl,
      salaryMin: s.vacancy.salaryMin,
      salaryMax: s.vacancy.salaryMax,
      location: s.vacancy.location,
    }));
  }

  async countDistinctCompaniesByProvider(providerId: string): Promise<number> {
    const result = await prisma.vacancy.groupBy({
      by: ['companyId'],
      where: {
        sources: { some: { providerId } },
      },
    });
    return result.length;
  }
}

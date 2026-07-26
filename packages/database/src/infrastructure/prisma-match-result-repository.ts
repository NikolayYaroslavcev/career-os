import type { MatchResult, MatchResultRepository } from '@careeros/ai';
import { prisma } from '../client.js';
import { MatchResultMapper } from '../mappers/match-result-mapper.js';

export class PrismaMatchResultRepository implements MatchResultRepository {
  async save(matchResult: MatchResult): Promise<void> {
    const data = MatchResultMapper.toPersistence(matchResult);

    await prisma.matchResult.upsert({
      where: { searchProfileId_vacancyId: { searchProfileId: data.searchProfileId, vacancyId: data.vacancyId } },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<MatchResult | null> {
    const record = await prisma.matchResult.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return MatchResultMapper.toDomain(record);
  }

  async findBySearchProfileIdAndVacancyId(
    searchProfileId: string,
    vacancyId: string
  ): Promise<MatchResult | null> {
    const record = await prisma.matchResult.findUnique({
      where: {
        searchProfileId_vacancyId: { searchProfileId, vacancyId },
      },
    });

    if (!record) {
      return null;
    }

    return MatchResultMapper.toDomain(record);
  }

  async findByUserId(userId: string): Promise<readonly MatchResult[]> {
    const records = await prisma.matchResult.findMany({
      where: { userId },
      orderBy: { overallScore: 'desc' },
    });

    return records.map(MatchResultMapper.toDomain);
  }

  async findBySearchProfileId(searchProfileId: string): Promise<readonly MatchResult[]> {
    const records = await prisma.matchResult.findMany({
      where: { searchProfileId },
      orderBy: { overallScore: 'desc' },
    });

    return records.map(MatchResultMapper.toDomain);
  }

  async findByVacancyIds(vacancyIds: readonly string[]): Promise<readonly MatchResult[]> {
    const records = await prisma.matchResult.findMany({
      where: { vacancyId: { in: [...vacancyIds] } },
    });

    return records.map(MatchResultMapper.toDomain);
  }
}

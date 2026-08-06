import type { VacancySourceRepository, SaveVacancySourceOptions } from '@careeros/career';
import type { VacancySourceId, VacancyId } from '@careeros/career';
import type { Source as VacancySourceEntity } from '@careeros/career';
import type { VacancySource as VacancySourceEnum } from '@careeros/career';
import type { Prisma } from '@prisma/client';
import { prisma } from '../client.js';
import { VacancySourceMapper } from '../mappers/vacancy-source-mapper.js';

export class PrismaVacancySourceRepository implements VacancySourceRepository {
  async findById(id: VacancySourceId): Promise<VacancySourceEntity | null> {
    const record = await prisma.vacancySource.findUnique({ where: { id } });
    if (!record) return null;
    return VacancySourceMapper.toDomain(record);
  }

  async findByVacancyId(vacancyId: VacancyId): Promise<VacancySourceEntity[]> {
    const records = await prisma.vacancySource.findMany({
      where: { vacancyId },
      orderBy: { discoveredAt: 'asc' },
    });
    return records.map(VacancySourceMapper.toDomain);
  }

  async findByVacancyIds(vacancyIds: readonly VacancyId[]): Promise<Map<string, VacancySourceEntity[]>> {
    const byId = new Map<string, VacancySourceEntity[]>();
    if (vacancyIds.length === 0) return byId;

    const records = await prisma.vacancySource.findMany({
      where: { vacancyId: { in: [...vacancyIds] } },
      orderBy: { discoveredAt: 'asc' },
    });
    for (const record of records) {
      const source = VacancySourceMapper.toDomain(record);
      const existing = byId.get(record.vacancyId);
      if (existing) {
        existing.push(source);
      } else {
        byId.set(record.vacancyId, [source]);
      }
    }
    return byId;
  }

  async findByVacancyIdAndProvider(
    vacancyId: VacancyId,
    providerId: VacancySourceEnum,
    externalId: string
  ): Promise<VacancySourceEntity | null> {
    const record = await prisma.vacancySource.findFirst({
      where: {
        vacancyId,
        providerId,
        externalId,
      },
    });
    if (!record) return null;
    return VacancySourceMapper.toDomain(record);
  }

  async findByProviderAndExternalId(
    providerId: VacancySourceEnum,
    externalId: string,
    workspaceId: string
  ): Promise<VacancySourceEntity | null> {
    const record = await prisma.vacancySource.findFirst({
      where: {
        providerId,
        externalId,
        vacancy: { workspaceId },
      },
    });
    if (!record) return null;
    return VacancySourceMapper.toDomain(record);
  }

  async findActiveByVacancyId(vacancyId: VacancyId): Promise<VacancySourceEntity[]> {
    const records = await prisma.vacancySource.findMany({
      where: { vacancyId, status: 'ACTIVE' },
      orderBy: { discoveredAt: 'asc' },
    });
    return records.map(VacancySourceMapper.toDomain);
  }

  async save(source: VacancySourceEntity, _options?: SaveVacancySourceOptions): Promise<void> {
    const data = VacancySourceMapper.toPersistence(source);
    const createData: Prisma.VacancySourceUncheckedCreateInput = {
      id: data.id,
      vacancyId: data.vacancyId,
      providerType: data.providerType,
      providerId: data.providerId,
      externalId: data.externalId,
      sourceUrl: data.sourceUrl,
      applyUrl: data.applyUrl,
      status: data.status,
      discoveredAt: data.discoveredAt,
      lastSeenAt: data.lastSeenAt,
      isPrimary: data.isPrimary,
      metadata: data.metadata as Prisma.InputJsonValue,
      lastSuccessfulSync: data.lastSuccessfulSync,
      lastFailedSync: data.lastFailedSync,
      failureCount: data.failureCount,
    };
    await prisma.vacancySource.upsert({
      where: { id: source.id },
      create: createData,
      update: {
        lastSeenAt: data.lastSeenAt,
        isPrimary: data.isPrimary,
        sourceUrl: data.sourceUrl,
        applyUrl: data.applyUrl,
        status: data.status,
        lastSuccessfulSync: data.lastSuccessfulSync,
        lastFailedSync: data.lastFailedSync,
        failureCount: data.failureCount,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async delete(id: VacancySourceId): Promise<void> {
    await prisma.vacancySource.delete({ where: { id } });
  }

  async exists(id: VacancySourceId): Promise<boolean> {
    const count = await prisma.vacancySource.count({ where: { id } });
    return count > 0;
  }

  async countByVacancyId(vacancyId: VacancyId): Promise<number> {
    return prisma.vacancySource.count({ where: { vacancyId } });
  }
}

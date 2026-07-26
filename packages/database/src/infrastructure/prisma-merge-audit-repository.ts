import type { MergeAuditRepository } from '@careeros/career';
import type { VacancyId } from '@careeros/career';
import type { VacancyMergeAudit } from '@careeros/career';
import type { Prisma } from '@prisma/client';
import { prisma } from '../client.js';
import { MergeAuditMapper } from '../mappers/merge-audit-mapper.js';

export class PrismaMergeAuditRepository implements MergeAuditRepository {
  async findByVacancyId(vacancyId: VacancyId): Promise<VacancyMergeAudit[]> {
    const records = await prisma.vacancyMergeAudit.findMany({
      where: { vacancyId },
      orderBy: { mergedAt: 'desc' },
    });

    const grouped = new Map<string, typeof records>();
    for (const record of records) {
      const key = `${record.id.split('-')[0]}`;
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(record);
      } else {
        grouped.set(key, [record]);
      }
    }

    return records.map(MergeAuditMapper.toDomain);
  }

  async save(audit: VacancyMergeAudit): Promise<void> {
    const records = MergeAuditMapper.toPersistence(audit);
    for (const record of records) {
      const data: Prisma.VacancyMergeAuditUncheckedCreateInput = {
        id: record.id,
        vacancyId: record.vacancyId,
        field: record.field,
        oldValue: record.oldValue as Prisma.InputJsonValue,
        newValue: record.newValue as Prisma.InputJsonValue,
        sourceId: record.sourceId,
        sourceName: record.sourceName,
        providerType: record.providerType,
        reason: record.reason,
        mergedAt: record.mergedAt,
      };
      await prisma.vacancyMergeAudit.create({ data });
    }
  }
}

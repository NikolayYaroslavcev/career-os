import { VacancyMergeAudit } from '@careeros/career';
import type { VacancyMergeAuditId, VacancyId } from '@careeros/career';
import type { MergeAuditEntryData } from '@careeros/career';
import type { ProviderType } from '@careeros/career';

interface PrismaMergeAudit {
  id: string;
  vacancyId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  sourceId: string;
  sourceName: string;
  providerType: string;
  reason: string | null;
  mergedAt: Date;
}

export class MergeAuditMapper {
  static toDomain(record: PrismaMergeAudit): VacancyMergeAudit {
    const entry: MergeAuditEntryData = {
      field: record.field,
      oldValue: record.oldValue,
      newValue: record.newValue,
      sourceId: record.sourceId,
      sourceName: record.sourceName,
      providerType: record.providerType as ProviderType,
      reason: record.reason ?? undefined,
    };

    return VacancyMergeAudit.create({
      id: record.id as VacancyMergeAuditId,
      vacancyId: record.vacancyId as VacancyId,
      entries: [entry],
    });
  }

  static toPersistence(audit: VacancyMergeAudit): Array<{
    id: string;
    vacancyId: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    sourceId: string;
    sourceName: string;
    providerType: ProviderType;
    reason: string | null;
    mergedAt: Date;
  }> {
    return audit.entries.map((entry: MergeAuditEntryData) => ({
      id: `${audit.id}-${entry.field}`,
      vacancyId: audit.vacancyId,
      field: entry.field,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      sourceId: entry.sourceId,
      sourceName: entry.sourceName,
      providerType: entry.providerType,
      reason: entry.reason ?? null,
      mergedAt: audit.mergedAt,
    }));
  }
}

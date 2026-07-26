import { Source, createVacancySourceId, createVacancyId } from '@careeros/career';
import type { ProviderType, SourceStatus } from '@careeros/career';

interface PrismaVacancySource {
  id: string;
  providerType: string;
  providerId: string;
  externalId: string;
  sourceUrl: string | null;
  applyUrl: string | null;
  status: string;
  discoveredAt: Date;
  lastSeenAt: Date;
  isPrimary: boolean;
  metadata: unknown;
  lastSuccessfulSync: Date | null;
  lastFailedSync: Date | null;
  failureCount: number;
  vacancyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class VacancySourceMapper {
  static toDomain(record: PrismaVacancySource): Source {
    return Source.reconstitute(createVacancySourceId(record.id), {
      vacancyId: createVacancyId(record.vacancyId),
      providerType: record.providerType as ProviderType,
      providerId: record.providerId as never,
      externalId: record.externalId,
      sourceUrl: record.sourceUrl ?? undefined,
      applyUrl: record.applyUrl ?? undefined,
      status: (record.status as SourceStatus) ?? 'ACTIVE',
      discoveredAt: record.discoveredAt,
      lastSeenAt: record.lastSeenAt,
      isPrimary: record.isPrimary,
      metadata: record.metadata as Record<string, unknown> | undefined,
      lastSuccessfulSync: record.lastSuccessfulSync ?? undefined,
      lastFailedSync: record.lastFailedSync ?? undefined,
      failureCount: record.failureCount,
    });
  }

  static toPersistence(source: {
    id: string;
    vacancyId: string;
    providerType: string;
    providerId: string;
    externalId: string;
    sourceUrl: string | undefined;
    applyUrl: string | undefined;
    status: string;
    discoveredAt: Date;
    lastSeenAt: Date;
    isPrimary: boolean;
    metadata: Record<string, unknown> | undefined;
    lastSuccessfulSync: Date | undefined;
    lastFailedSync: Date | undefined;
    failureCount: number;
  }): {
    id: string;
    vacancyId: string;
    providerType: ProviderType;
    providerId: string;
    externalId: string;
    sourceUrl: string | null;
    applyUrl: string | null;
    status: SourceStatus;
    discoveredAt: Date;
    lastSeenAt: Date;
    isPrimary: boolean;
    metadata: Record<string, unknown> | undefined;
    lastSuccessfulSync: Date | null;
    lastFailedSync: Date | null;
    failureCount: number;
  } {
    return {
      id: source.id,
      vacancyId: source.vacancyId,
      providerType: source.providerType as ProviderType,
      providerId: source.providerId,
      externalId: source.externalId,
      sourceUrl: source.sourceUrl ?? null,
      applyUrl: source.applyUrl ?? null,
      status: source.status as SourceStatus,
      discoveredAt: source.discoveredAt,
      lastSeenAt: source.lastSeenAt,
      isPrimary: source.isPrimary,
      metadata: source.metadata ?? undefined,
      lastSuccessfulSync: source.lastSuccessfulSync ?? null,
      lastFailedSync: source.lastFailedSync ?? null,
      failureCount: source.failureCount,
    };
  }
}

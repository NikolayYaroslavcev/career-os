import type { VacancySourceId, VacancyId } from '../base/identifier.js';
import type { Source as VacancySourceEntity } from '../entities/vacancy-source.js';
import type { VacancySource as VacancySourceEnum } from '../enums/vacancy-source.js';

export interface SaveVacancySourceOptions {
  workspaceId: string;
}

export interface VacancySourceRepository {
  findById(id: VacancySourceId): Promise<VacancySourceEntity | null>;
  findByVacancyId(vacancyId: VacancyId): Promise<VacancySourceEntity[]>;
  /** Batch variant of findByVacancyId — one query for many vacancies, avoiding N+1 in analytics/reporting paths. */
  findByVacancyIds(vacancyIds: readonly VacancyId[]): Promise<Map<string, VacancySourceEntity[]>>;
  findByVacancyIdAndProvider(vacancyId: VacancyId, providerId: VacancySourceEnum, externalId: string): Promise<VacancySourceEntity | null>;
  /** Scoped to a single workspace — the same external listing may legitimately have a separate VacancySource per workspace. */
  findByProviderAndExternalId(providerId: VacancySourceEnum, externalId: string, workspaceId: string): Promise<VacancySourceEntity | null>;
  save(source: VacancySourceEntity, options?: SaveVacancySourceOptions): Promise<void>;
  delete(id: VacancySourceId): Promise<void>;
  exists(id: VacancySourceId): Promise<boolean>;
  countByVacancyId(vacancyId: VacancyId): Promise<number>;
}

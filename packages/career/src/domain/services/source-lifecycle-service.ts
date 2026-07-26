import type { Source as VacancySourceEntity } from '../entities/vacancy-source.js';
import type { SourceStatus } from '../enums/source-status.js';

export interface SourceSyncResult {
  sourceId: string;
  previousStatus: SourceStatus;
  newStatus: SourceStatus;
  changed: boolean;
}

export interface SourceLifecycleService {
  recordSyncSuccess(source: VacancySourceEntity): Promise<SourceSyncResult>;
  recordSyncFailure(source: VacancySourceEntity): Promise<SourceSyncResult>;
  markSourceExpired(sourceId: string, reason?: string): Promise<SourceSyncResult>;
  markSourceRemoved(sourceId: string, reason?: string): Promise<SourceSyncResult>;
  recalculateVacancyActiveStatus(vacancyId: string): Promise<boolean>;
  computePrimaryApplyUrl(sources: VacancySourceEntity[]): string | undefined;
}

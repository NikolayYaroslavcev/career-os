import type { Source as VacancySourceEntity } from '../entities/vacancy-source.js';
import type { SourceStatus } from '../enums/source-status.js';
import type { SourceLifecycleService, SourceSyncResult } from './source-lifecycle-service.js';
import { PROVIDER_PRIORITY } from '../enums/source-priority.js';

export class SourceLifecycleServiceImpl implements SourceLifecycleService {
  async recordSyncSuccess(source: VacancySourceEntity): Promise<SourceSyncResult> {
    const previousStatus = source.status;
    source.recordSyncSuccess();
    return {
      sourceId: source.id,
      previousStatus,
      newStatus: source.status,
      changed: previousStatus !== source.status,
    };
  }

  async recordSyncFailure(source: VacancySourceEntity): Promise<SourceSyncResult> {
    const previousStatus = source.status;
    source.recordSyncFailure();
    return {
      sourceId: source.id,
      previousStatus,
      newStatus: source.status,
      changed: previousStatus !== source.status,
    };
  }

  async markSourceExpired(sourceId: string, _reason?: string): Promise<SourceSyncResult> {
    return {
      sourceId,
      previousStatus: 'ACTIVE' as SourceStatus,
      newStatus: 'EXPIRED' as SourceStatus,
      changed: true,
    };
  }

  async markSourceRemoved(sourceId: string, _reason?: string): Promise<SourceSyncResult> {
    return {
      sourceId,
      previousStatus: 'ACTIVE' as SourceStatus,
      newStatus: 'REMOVED' as SourceStatus,
      changed: true,
    };
  }

  async recalculateVacancyActiveStatus(vacancyId: string): Promise<boolean> {
    void vacancyId;
    return true;
  }

  computePrimaryApplyUrl(sources: VacancySourceEntity[]): string | undefined {
    const activeSources = sources.filter((s) => s.isActive);

    if (activeSources.length === 0) {
      return sources.length > 0 ? sources[0]!.applyUrl : undefined;
    }

    const sorted = [...activeSources].sort((a, b) => {
      const priorityA = PROVIDER_PRIORITY[a.providerId] ?? 99;
      const priorityB = PROVIDER_PRIORITY[b.providerId] ?? 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
    });

    for (const source of sorted) {
      if (source.applyUrl) return source.applyUrl;
    }

    for (const source of sorted) {
      if (source.sourceUrl) return source.sourceUrl;
    }

    return undefined;
  }
}

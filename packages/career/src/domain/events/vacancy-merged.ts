import { BaseDomainEvent } from '../base/domain-event.js';

export interface MergeAuditEntry {
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly providerType: string;
  readonly reason?: string;
}

export class VacancyMergedEvent extends BaseDomainEvent {
  readonly entries: MergeAuditEntry[];

  constructor(aggregateId: string, entries: MergeAuditEntry[]) {
    super('VacancyMerged', aggregateId);
    this.entries = entries;
  }
}

import { AggregateRoot } from '../base/aggregate-root.js';
import type { VacancyId } from '../base/identifier.js';
import type { ProviderType } from '../enums/provider-type.js';

export type VacancyMergeAuditId = string & { readonly __brand: 'VacancyMergeAuditId' };

export interface MergeAuditEntryData {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  sourceId: string;
  sourceName: string;
  providerType: ProviderType;
  reason?: string;
}

interface MergeAuditProps {
  vacancyId: VacancyId;
  entries: MergeAuditEntryData[];
  mergedAt: Date;
}

export class VacancyMergeAudit extends AggregateRoot<VacancyMergeAuditId> {
  private props: MergeAuditProps;

  private constructor(id: VacancyMergeAuditId, props: MergeAuditProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: VacancyMergeAuditId;
    vacancyId: VacancyId;
    entries: MergeAuditEntryData[];
  }): VacancyMergeAudit {
    return new VacancyMergeAudit(params.id, {
      vacancyId: params.vacancyId,
      entries: params.entries,
      mergedAt: new Date(),
    });
  }

  get vacancyId(): VacancyId {
    return this.props.vacancyId;
  }

  get entries(): ReadonlyArray<MergeAuditEntryData> {
    return [...this.props.entries];
  }

  get mergedAt(): Date {
    return this.props.mergedAt;
  }
}

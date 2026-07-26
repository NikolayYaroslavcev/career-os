import { BaseDomainEvent } from '../base/domain-event.js';

export class VacancyDiscoveredEvent extends BaseDomainEvent {
  readonly companyId: string;
  readonly title: string;
  readonly source: string;
  readonly sourceUrl?: string;

  constructor(params: {
    aggregateId: string;
    companyId: string;
    title: string;
    source: string;
    sourceUrl?: string;
  }) {
    super('VacancyDiscovered', params.aggregateId);
    this.companyId = params.companyId;
    this.title = params.title;
    this.source = params.source;
    this.sourceUrl = params.sourceUrl;
  }
}

import { BaseDomainEvent } from '../base/domain-event.js';

export class VacancyMatchedEvent extends BaseDomainEvent {
  readonly userId: string;
  readonly vacancyId: string;
  readonly matchScore: number;
  readonly reasons: string[];

  constructor(params: {
    aggregateId: string;
    userId: string;
    vacancyId: string;
    matchScore: number;
    reasons: string[];
  }) {
    super('VacancyMatched', params.aggregateId);
    this.userId = params.userId;
    this.vacancyId = params.vacancyId;
    this.matchScore = params.matchScore;
    this.reasons = params.reasons;
  }
}

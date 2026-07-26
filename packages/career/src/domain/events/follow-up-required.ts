import { BaseDomainEvent } from '../base/domain-event.js';

export class FollowUpRequiredEvent extends BaseDomainEvent {
  readonly applicationId: string;
  readonly userId: string;
  readonly followUpDate: Date;
  readonly message: string;

  constructor(params: {
    aggregateId: string;
    applicationId: string;
    userId: string;
    followUpDate: Date;
    message: string;
  }) {
    super('FollowUpRequired', params.aggregateId);
    this.applicationId = params.applicationId;
    this.userId = params.userId;
    this.followUpDate = params.followUpDate;
    this.message = params.message;
  }
}

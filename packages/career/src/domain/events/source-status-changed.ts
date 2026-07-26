import { BaseDomainEvent } from '../base/domain-event.js';
import type { SourceStatus } from '../enums/source-status.js';

export class SourceStatusChangedEvent extends BaseDomainEvent {
  readonly sourceId: string;
  readonly oldStatus: SourceStatus;
  readonly newStatus: SourceStatus;
  readonly reason?: string;

  constructor(
    aggregateId: string,
    sourceId: string,
    oldStatus: SourceStatus,
    newStatus: SourceStatus,
    reason?: string
  ) {
    super('SourceStatusChanged', aggregateId);
    this.sourceId = sourceId;
    this.oldStatus = oldStatus;
    this.newStatus = newStatus;
    this.reason = reason;
  }
}

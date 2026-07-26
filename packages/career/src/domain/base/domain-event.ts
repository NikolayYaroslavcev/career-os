export interface DomainEvent {
  readonly eventType: string;
  readonly occurredOn: Date;
  readonly aggregateId: string;
}

export abstract class BaseDomainEvent implements DomainEvent {
  readonly eventType: string;
  readonly occurredOn: Date;
  readonly aggregateId: string;

  protected constructor(eventType: string, aggregateId: string) {
    this.eventType = eventType;
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
  }
}

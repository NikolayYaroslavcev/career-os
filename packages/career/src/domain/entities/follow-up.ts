import { Entity } from '../base/entity.js';
import type { FollowUpId, ApplicationId } from '../base/identifier.js';
import { FollowUpStatus } from '../enums/follow-up-status.js';
import { FollowUpType } from '../enums/follow-up-type.js';

interface FollowUpProps {
  applicationId: ApplicationId;
  scheduledAt: Date;
  status: FollowUpStatus;
  message?: string;
  sentAt?: Date;
  snoozedUntil?: Date;
  /** Undefined for follow-ups scheduled manually before this field existed, or via the free-form manual form. */
  type?: FollowUpType;
  createdAt: Date;
  updatedAt: Date;
}

/** A scheduled reminder to follow up on an application, tracked through to delivery. */
export class FollowUp extends Entity<FollowUpId> {
  private props: FollowUpProps;

  private constructor(id: FollowUpId, props: FollowUpProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: FollowUpId;
    applicationId: ApplicationId;
    scheduledAt: Date;
    message?: string;
    type?: FollowUpType;
  }): FollowUp {
    if (params.scheduledAt <= new Date()) {
      throw new Error('Follow-up date must be in the future');
    }

    const now = new Date();

    return new FollowUp(params.id, {
      applicationId: params.applicationId,
      scheduledAt: params.scheduledAt,
      status: FollowUpStatus.PENDING,
      message: params.message?.trim() || undefined,
      type: params.type,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: FollowUpId, props: FollowUpProps): FollowUp {
    return new FollowUp(id, props);
  }

  get applicationId(): ApplicationId {
    return this.props.applicationId;
  }

  get scheduledAt(): Date {
    return this.props.scheduledAt;
  }

  get status(): FollowUpStatus {
    return this.props.status;
  }

  get message(): string | undefined {
    return this.props.message;
  }

  get sentAt(): Date | undefined {
    return this.props.sentAt;
  }

  get snoozedUntil(): Date | undefined {
    return this.props.snoozedUntil;
  }

  get type(): FollowUpType | undefined {
    return this.props.type;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isDue(): boolean {
    const isPending = this.props.status === FollowUpStatus.PENDING || this.props.status === FollowUpStatus.SNOOZED;
    return isPending && this.props.scheduledAt <= new Date();
  }

  private assertNotTerminal(): void {
    if (this.props.status === FollowUpStatus.COMPLETED || this.props.status === FollowUpStatus.CANCELLED) {
      throw new Error(`Cannot modify a follow-up that is already ${this.props.status}`);
    }
  }

  markSent(): void {
    this.assertNotTerminal();
    this.props.status = FollowUpStatus.SENT;
    this.props.sentAt = new Date();
    this.touch();
  }

  complete(): void {
    this.assertNotTerminal();
    this.props.status = FollowUpStatus.COMPLETED;
    this.touch();
  }

  snooze(until: Date): void {
    this.assertNotTerminal();

    if (until <= new Date()) {
      throw new Error('Snooze date must be in the future');
    }

    this.props.status = FollowUpStatus.SNOOZED;
    this.props.snoozedUntil = until;
    this.props.scheduledAt = until;
    this.touch();
  }

  cancel(): void {
    this.assertNotTerminal();
    this.props.status = FollowUpStatus.CANCELLED;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}

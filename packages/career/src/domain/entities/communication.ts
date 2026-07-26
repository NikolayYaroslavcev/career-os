import { Entity } from '../base/entity.js';
import type { CommunicationId, ApplicationId } from '../base/identifier.js';
import { CommunicationType, CommunicationDirection } from '../enums/communication-type.js';

interface CommunicationProps {
  applicationId: ApplicationId;
  type: CommunicationType;
  direction: CommunicationDirection;
  content?: string;
  subject?: string;
  sentAt: Date;
}

/** An immutable log entry of a single interaction (email, call, message) tied to an application. */
export class Communication extends Entity<CommunicationId> {
  private props: CommunicationProps;

  private constructor(id: CommunicationId, props: CommunicationProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: CommunicationId;
    applicationId: ApplicationId;
    type: CommunicationType;
    direction: CommunicationDirection;
    content?: string;
    subject?: string;
    sentAt?: Date;
  }): Communication {
    return new Communication(params.id, {
      applicationId: params.applicationId,
      type: params.type,
      direction: params.direction,
      content: params.content?.trim(),
      subject: params.subject?.trim(),
      sentAt: params.sentAt ?? new Date(),
    });
  }

  static reconstitute(id: CommunicationId, props: CommunicationProps): Communication {
    return new Communication(id, props);
  }

  get applicationId(): ApplicationId {
    return this.props.applicationId;
  }

  get type(): CommunicationType {
    return this.props.type;
  }

  get direction(): CommunicationDirection {
    return this.props.direction;
  }

  get content(): string | undefined {
    return this.props.content;
  }

  get subject(): string | undefined {
    return this.props.subject;
  }

  get sentAt(): Date {
    return this.props.sentAt;
  }
}

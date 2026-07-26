import { AggregateRoot } from '../base/aggregate-root.js';
import type { InterviewId, ApplicationId } from '../base/identifier.js';
import { InterviewType } from '../enums/interview-type.js';
import { BaseDomainEvent } from '../base/domain-event.js';

interface InterviewProps {
  applicationId: ApplicationId;
  type: InterviewType;
  scheduledAt: Date;
  durationMinutes: number;
  interviewerName?: string;
  interviewerEmail?: string;
  location?: string;
  notes?: string;
  isCompleted: boolean;
  feedback?: InterviewFeedback;
  createdAt: Date;
  updatedAt: Date;
}

interface InterviewFeedback {
  rating: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: 'hire' | 'maybe' | 'no_hire';
}

export class InterviewScheduledEvent extends BaseDomainEvent {
  readonly applicationId: string;
  readonly interviewType: InterviewType;
  readonly scheduledAt: Date;

  constructor(
    aggregateId: string,
    applicationId: string,
    interviewType: InterviewType,
    scheduledAt: Date
  ) {
    super('InterviewScheduled', aggregateId);
    this.applicationId = applicationId;
    this.interviewType = interviewType;
    this.scheduledAt = scheduledAt;
  }
}

export class InterviewCompletedEvent extends BaseDomainEvent {
  readonly applicationId: string;
  readonly rating: number;
  readonly recommendation: string;

  constructor(
    aggregateId: string,
    applicationId: string,
    rating: number,
    recommendation: string
  ) {
    super('InterviewCompleted', aggregateId);
    this.applicationId = applicationId;
    this.rating = rating;
    this.recommendation = recommendation;
  }
}

export class Interview extends AggregateRoot<InterviewId> {
  private props: InterviewProps;

  private constructor(id: InterviewId, props: InterviewProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: InterviewId;
    applicationId: ApplicationId;
    type: InterviewType;
    scheduledAt: Date;
    durationMinutes?: number;
    interviewerName?: string;
    interviewerEmail?: string;
    location?: string;
  }): Interview {
    const INTERVIEW_DURATION_MINUTES: Record<InterviewType, number> = {
      [InterviewType.HR]: 30,
      [InterviewType.TECHNICAL]: 60,
      [InterviewType.SYSTEM_DESIGN]: 60,
      [InterviewType.BEHAVIORAL]: 45,
      [InterviewType.CODING]: 90,
      [InterviewType.CULTURAL]: 30,
      [InterviewType.FINAL]: 60,
    };

    const now = new Date();

    const interview = new Interview(params.id, {
      applicationId: params.applicationId,
      type: params.type,
      scheduledAt: params.scheduledAt,
      durationMinutes: params.durationMinutes ?? INTERVIEW_DURATION_MINUTES[params.type],
      interviewerName: params.interviewerName?.trim(),
      interviewerEmail: params.interviewerEmail?.trim(),
      location: params.location?.trim(),
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    interview.addDomainEvent(
      new InterviewScheduledEvent(
        params.id,
        params.applicationId,
        params.type,
        params.scheduledAt
      )
    );

    return interview;
  }

  static reconstitute(id: InterviewId, props: InterviewProps): Interview {
    return new Interview(id, props);
  }

  get applicationId(): ApplicationId {
    return this.props.applicationId;
  }

  get type(): InterviewType {
    return this.props.type;
  }

  get scheduledAt(): Date {
    return this.props.scheduledAt;
  }

  get durationMinutes(): number {
    return this.props.durationMinutes;
  }

  get interviewerName(): string | undefined {
    return this.props.interviewerName;
  }

  get interviewerEmail(): string | undefined {
    return this.props.interviewerEmail;
  }

  get location(): string | undefined {
    return this.props.location;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  get isCompleted(): boolean {
    return this.props.isCompleted;
  }

  get feedback(): InterviewFeedback | undefined {
    return this.props.feedback;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isUpcoming(): boolean {
    return !this.props.isCompleted && this.props.scheduledAt > new Date();
  }

  get isPastDue(): boolean {
    return !this.props.isCompleted && this.props.scheduledAt < new Date();
  }

  reschedule(newDate: Date): void {
    if (this.props.isCompleted) {
      throw new Error('Cannot reschedule a completed interview');
    }

    this.props.scheduledAt = newDate;
    this.touch();
  }

  updateDetails(params: {
    interviewerName?: string;
    interviewerEmail?: string;
    location?: string;
    notes?: string;
  }): void {
    if (params.interviewerName !== undefined) this.props.interviewerName = params.interviewerName.trim();
    if (params.interviewerEmail !== undefined) this.props.interviewerEmail = params.interviewerEmail.trim();
    if (params.location !== undefined) this.props.location = params.location.trim();
    if (params.notes !== undefined) this.props.notes = params.notes.trim();
    this.touch();
  }

  complete(feedback: InterviewFeedback): void {
    if (this.props.isCompleted) {
      throw new Error('Interview is already completed');
    }

    if (feedback.rating < 1 || feedback.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    this.props.isCompleted = true;
    this.props.feedback = feedback;

    this.addDomainEvent(
      new InterviewCompletedEvent(
        this.id,
        this.props.applicationId,
        feedback.rating,
        feedback.recommendation
      )
    );

    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}

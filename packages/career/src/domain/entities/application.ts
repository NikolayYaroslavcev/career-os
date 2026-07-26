import { AggregateRoot } from '../base/aggregate-root.js';
import type { ApplicationId, UserId, VacancyId, ResumeId, RecruiterId } from '../base/identifier.js';
import { ApplicationStatus, canTransitionTo } from '../enums/application-status.js';
import { BaseDomainEvent } from '../base/domain-event.js';

interface ApplicationNote {
  content: string;
  createdAt: Date;
}

interface ApplicationProps {
  userId: UserId;
  vacancyId: VacancyId;
  resumeId?: ResumeId;
  matchResultId?: string;
  recruiterId?: RecruiterId;
  status: ApplicationStatus;
  notes: ApplicationNote[];
  startedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ApplicationStatusChangedEvent extends BaseDomainEvent {
  readonly previousStatus: ApplicationStatus;
  readonly newStatus: ApplicationStatus;

  constructor(
    aggregateId: string,
    previousStatus: ApplicationStatus,
    newStatus: ApplicationStatus
  ) {
    super('ApplicationStatusChanged', aggregateId);
    this.previousStatus = previousStatus;
    this.newStatus = newStatus;
  }
}

export class ApplicationCreatedEvent extends BaseDomainEvent {
  readonly userId: string;
  readonly vacancyId: string;

  constructor(aggregateId: string, userId: string, vacancyId: string) {
    super('ApplicationCreated', aggregateId);
    this.userId = userId;
    this.vacancyId = vacancyId;
  }
}

export class Application extends AggregateRoot<ApplicationId> {
  private props: ApplicationProps;

  private constructor(id: ApplicationId, props: ApplicationProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: ApplicationId;
    userId: UserId;
    vacancyId: VacancyId;
    resumeId?: ResumeId;
    matchResultId?: string;
  }): Application {
    const now = new Date();

    const application = new Application(params.id, {
      userId: params.userId,
      vacancyId: params.vacancyId,
      resumeId: params.resumeId,
      matchResultId: params.matchResultId,
      status: ApplicationStatus.SAVED,
      notes: [],
      createdAt: now,
      updatedAt: now,
    });

    application.addDomainEvent(
      new ApplicationCreatedEvent(params.id, params.userId, params.vacancyId)
    );

    return application;
  }

  static reconstitute(id: ApplicationId, props: ApplicationProps): Application {
    return new Application(id, props);
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get vacancyId(): VacancyId {
    return this.props.vacancyId;
  }

  get resumeId(): ResumeId | undefined {
    return this.props.resumeId;
  }

  get matchResultId(): string | undefined {
    return this.props.matchResultId;
  }

  get recruiterId(): RecruiterId | undefined {
    return this.props.recruiterId;
  }

  get status(): ApplicationStatus {
    return this.props.status;
  }

  get notes(): ReadonlyArray<ApplicationNote> {
    return [...this.props.notes];
  }

  get startedAt(): Date | undefined {
    return this.props.startedAt;
  }

  get submittedAt(): Date | undefined {
    return this.props.submittedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isTerminal(): boolean {
    return (
      this.props.status === ApplicationStatus.REJECTED ||
      this.props.status === ApplicationStatus.ARCHIVED
    );
  }

  changeStatus(newStatus: ApplicationStatus): void {
    if (this.isTerminal) {
      throw new Error('Cannot change status of a terminal application');
    }

    if (this.props.status === newStatus) {
      throw new Error('Cannot change to the same status');
    }

    if (!canTransitionTo(this.props.status, newStatus)) {
      throw new Error(`Invalid status transition from ${this.props.status} to ${newStatus}`);
    }

    const previousStatus = this.props.status;
    this.props.status = newStatus;

    if (newStatus === ApplicationStatus.STARTED && !this.props.startedAt) {
      this.props.startedAt = new Date();
    }

    if (newStatus === ApplicationStatus.SUBMITTED && !this.props.submittedAt) {
      this.props.submittedAt = new Date();
    }

    this.addDomainEvent(
      new ApplicationStatusChangedEvent(this.id, previousStatus, newStatus)
    );

    this.touch();
  }

  start(): void {
    this.changeStatus(ApplicationStatus.STARTED);
  }

  submit(): void {
    this.changeStatus(ApplicationStatus.SUBMITTED);
  }

  addNote(content: string): void {
    const trimmed = content.trim();

    if (trimmed.length === 0) {
      throw new Error('Note content cannot be empty');
    }

    this.props.notes.push({
      content: trimmed,
      createdAt: new Date(),
    });

    this.touch();
  }

  assignRecruiter(recruiterId: RecruiterId): void {
    this.props.recruiterId = recruiterId;
    this.touch();
  }

  unassignRecruiter(): void {
    this.props.recruiterId = undefined;
    this.touch();
  }

  archive(): void {
    this.changeStatus(ApplicationStatus.ARCHIVED);
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}

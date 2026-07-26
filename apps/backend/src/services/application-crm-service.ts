import {
  createApplicationId,
  createUserId,
  createVacancyId,
  createRecruiterId,
  createCommunicationId,
  createInterviewId,
  Communication,
  Interview,
  ApplicationStatus,
  FollowUpType,
} from '@careeros/career';
import type {
  Application,
  ApplicationService,
  ApplicationRepository,
  Communication as CommunicationEntity,
  CommunicationRepository,
  CommunicationType,
  CommunicationDirection,
  Interview as InterviewEntity,
  InterviewRepository,
  InterviewType,
  RecruiterRepository,
  FollowUp,
} from '@careeros/career';
import type { AnalyticsEventRepository } from '@careeros/database';
import type { FollowUpService } from './follow-up-service.js';

/** How long after submitting an application to nudge the user to follow up (EPIC follow-up automation). */
const FOLLOW_UP_AFTER_SUBMIT_DAYS = 6;
/** How long after an interview round concludes to nudge the user to follow up. */
const FOLLOW_UP_AFTER_INTERVIEW_DAYS = 3;
/** How long before a scheduled interview to remind the user. */
const INTERVIEW_REMINDER_LEAD_HOURS = 24;

const INTERVIEW_STAGE_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  ApplicationStatus.HR_INTERVIEW,
  ApplicationStatus.TECHNICAL_INTERVIEW,
  ApplicationStatus.FINAL_INTERVIEW,
]);

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export class ApplicationNotFoundError extends Error {
  constructor(id: string) {
    super(`Application '${id}' not found`);
    this.name = 'ApplicationNotFoundError';
  }
}

export class ApplicationNotAuthorizedError extends Error {
  constructor(id: string) {
    super(`Application '${id}' does not belong to this user`);
    this.name = 'ApplicationNotAuthorizedError';
  }
}

export class RecruiterNotAuthorizedError extends Error {
  constructor(id: string) {
    super(`Recruiter '${id}' not found in this workspace`);
    this.name = 'RecruiterNotAuthorizedError';
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStatusTransitionError';
  }
}

export interface ListApplicationsOptions {
  readonly status?: ApplicationStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListApplicationsResult {
  readonly applications: Application[];
  readonly total: number;
}

export interface PipelineGroup {
  readonly status: ApplicationStatus;
  readonly count: number;
  readonly applications: Application[];
}

export class ApplicationCrmService {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly applicationRepository: ApplicationRepository,
    private readonly recruiterRepository: RecruiterRepository,
    private readonly communicationRepository: CommunicationRepository,
    private readonly interviewRepository: InterviewRepository,
    private readonly followUpService: FollowUpService,
    private readonly analyticsEventRepository?: AnalyticsEventRepository
  ) {}

  async list(userId: string, options: ListApplicationsOptions = {}): Promise<ListApplicationsResult> {
    const all = options.status
      ? await this.applicationRepository.findByUserIdAndStatus(
          createUserId(userId),
          options.status
        )
      : await this.applicationRepository.findByUserId(createUserId(userId));

    const sorted = [...all].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = options.offset ?? 0;
    const limit = options.limit ?? sorted.length;

    return {
      applications: sorted.slice(offset, offset + limit),
      total: sorted.length,
    };
  }

  async getOwned(id: string, userId: string): Promise<Application> {
    const application = await this.applicationRepository.findById(createApplicationId(id));

    if (!application) {
      throw new ApplicationNotFoundError(id);
    }

    if (application.userId !== userId) {
      throw new ApplicationNotAuthorizedError(id);
    }

    return application;
  }

  async getOwnedByVacancy(userId: string, vacancyId: string): Promise<Application | null> {
    return this.applicationRepository.findByUserIdAndVacancyId(
      createUserId(userId),
      createVacancyId(vacancyId)
    );
  }

  async update(
    id: string,
    userId: string,
    input: { notes?: string }
  ): Promise<Application> {
    const application = await this.getOwned(id, userId);

    if (input.notes !== undefined) {
      await this.applicationService.addNote(application.id, input.notes);
    }

    return this.getOwned(id, userId);
  }

  async changeStatus(id: string, userId: string, status: ApplicationStatus): Promise<Application> {
    const application = await this.getOwned(id, userId);
    const previousStatus = application.status;

    try {
      await this.applicationService.changeStatus(application.id, status);
    } catch (error) {
      if (error instanceof Error) {
        throw new InvalidStatusTransitionError(error.message);
      }
      throw error;
    }

    await this.triggerFollowUpAutomation(application, previousStatus, status);

    const eventType = status === 'started' ? 'application_started'
      : status === 'submitted' ? 'application_submitted'
      : status === 'waiting' ? 'application_waiting'
      : status === 'rejected' ? 'application_rejected'
      : status === 'offer' ? 'offer_received'
      : 'status_changed';

    await this.analyticsEventRepository?.record({
      userId,
      eventType,
      entityType: 'application',
      entityId: id,
      metadata: { from: previousStatus, to: status },
    });

    await this.analyticsEventRepository?.record({
      userId,
      eventType: 'status_changed',
      entityType: 'application',
      entityId: id,
      metadata: { from: previousStatus, to: status },
    });

    return this.getOwned(id, userId);
  }

  async addNote(id: string, userId: string, content: string): Promise<Application> {
    const application = await this.getOwned(id, userId);
    await this.applicationService.addNote(application.id, content);
    return this.getOwned(id, userId);
  }

  async scheduleFollowUp(id: string, userId: string, date: Date, message?: string): Promise<FollowUp> {
    await this.getOwned(id, userId);
    return this.followUpService.schedule(id, userId, date, message);
  }

  async listFollowUps(id: string, userId: string): Promise<FollowUp[]> {
    await this.getOwned(id, userId);
    return this.followUpService.listForApplication(id, userId);
  }

  async snoozeFollowUp(followUpId: string, userId: string, until: Date): Promise<FollowUp> {
    return this.followUpService.snooze(followUpId, userId, until);
  }

  async completeFollowUp(followUpId: string, userId: string): Promise<FollowUp> {
    return this.followUpService.complete(followUpId, userId);
  }

  async cancelFollowUp(followUpId: string, userId: string): Promise<FollowUp> {
    return this.followUpService.cancel(followUpId, userId);
  }

  async assignRecruiter(
    id: string,
    userId: string,
    recruiterId: string,
    workspaceId: string
  ): Promise<Application> {
    const application = await this.getOwned(id, userId);
    const recruiters = await this.recruiterRepository.findByWorkspaceId(workspaceId);

    if (!recruiters.some((r) => r.id === recruiterId)) {
      throw new RecruiterNotAuthorizedError(recruiterId);
    }

    await this.applicationService.assignRecruiter(application.id, createRecruiterId(recruiterId));
    return this.getOwned(id, userId);
  }

  async getPipeline(userId: string): Promise<PipelineGroup[]> {
    const applications = await this.applicationRepository.findByUserId(createUserId(userId));
    const groups = new Map<ApplicationStatus, Application[]>();

    for (const application of applications) {
      const bucket = groups.get(application.status) ?? [];
      bucket.push(application);
      groups.set(application.status, bucket);
    }

    return [...groups.entries()].map(([status, apps]) => ({
      status,
      count: apps.length,
      applications: apps.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    }));
  }

  async addCommunication(
    id: string,
    userId: string,
    input: { type: CommunicationType; direction: CommunicationDirection; content?: string; subject?: string }
  ): Promise<CommunicationEntity> {
    const application = await this.getOwned(id, userId);

    const communication = Communication.create({
      id: createCommunicationId(crypto.randomUUID()),
      applicationId: application.id,
      type: input.type,
      direction: input.direction,
      content: input.content,
      subject: input.subject,
    });

    await this.communicationRepository.save(communication);
    return communication;
  }

  async listCommunications(id: string, userId: string): Promise<CommunicationEntity[]> {
    const application = await this.getOwned(id, userId);
    return this.communicationRepository.findByApplicationId(application.id);
  }

  async scheduleInterview(
    id: string,
    userId: string,
    input: {
      type: InterviewType;
      scheduledAt: Date;
      durationMinutes?: number;
      interviewerName?: string;
      interviewerEmail?: string;
      location?: string;
      notes?: string;
    }
  ): Promise<InterviewEntity> {
    const application = await this.getOwned(id, userId);

    const interview = Interview.create({
      id: createInterviewId(crypto.randomUUID()),
      applicationId: application.id,
      type: input.type,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      interviewerName: input.interviewerName,
      interviewerEmail: input.interviewerEmail,
      location: input.location,
    });

    if (input.notes !== undefined) {
      interview.updateDetails({ notes: input.notes });
    }

    await this.interviewRepository.save(interview);

    await this.followUpService.scheduleAutomatic(
      application,
      FollowUpType.INTERVIEW,
      addHours(interview.scheduledAt, -INTERVIEW_REMINDER_LEAD_HOURS)
    );

    return interview;
  }

  /**
   * EPIC follow-up automation: reacts to the status transition just persisted by changeStatus()
   * and schedules/cancels FollowUps through the existing FollowUpService — no separate reminder
   * or notification system, this only decides *when* a FollowUp should exist.
   *
   * The generic "submitted"/"interview scheduled"/"interview completed"/"rejected" lifecycle maps
   * onto this app's actual ApplicationStatus enum as follows:
   *  - SUBMITTED: nudge to follow up ~a week after applying.
   *  - Leaving an interview-stage status (HR/TECHNICAL/FINAL_INTERVIEW) for anything other than
   *    REJECTED/ARCHIVED: that interview round concluded, nudge a few days later. (There is no
   *    separate "interview completed" status or event in this codebase to hook instead.)
   *  - REJECTED or ARCHIVED: cancel whatever's still pending — no point nudging a dead lead.
   *  - OFFER: terminal success, no automation either way (mirrors "hired: no follow-up").
   */
  private async triggerFollowUpAutomation(
    application: Application,
    previousStatus: ApplicationStatus,
    newStatus: ApplicationStatus
  ): Promise<void> {
    if (newStatus === ApplicationStatus.REJECTED || newStatus === ApplicationStatus.ARCHIVED) {
      await this.followUpService.cancelPendingForApplication(application.id);
      return;
    }

    if (newStatus === ApplicationStatus.SUBMITTED && previousStatus !== ApplicationStatus.SUBMITTED) {
      await this.followUpService.scheduleAutomatic(
        application,
        FollowUpType.FOLLOW_UP,
        addDays(new Date(), FOLLOW_UP_AFTER_SUBMIT_DAYS)
      );
      return;
    }

    if (INTERVIEW_STAGE_STATUSES.has(previousStatus) && previousStatus !== newStatus) {
      await this.followUpService.scheduleAutomatic(
        application,
        FollowUpType.FOLLOW_UP,
        addDays(new Date(), FOLLOW_UP_AFTER_INTERVIEW_DAYS)
      );
    }
  }

  async listInterviews(id: string, userId: string): Promise<InterviewEntity[]> {
    const application = await this.getOwned(id, userId);
    return this.interviewRepository.findByApplicationId(application.id);
  }
}

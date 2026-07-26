import { createApplicationId, createFollowUpId, createUserId, FollowUp, FollowUpType } from '@careeros/career';
import type { Application, ApplicationRepository, FollowUpRepository, VacancyRepository, CompanyRepository, FollowUpStatus } from '@careeros/career';
import { buildDefaultFollowUpMessage } from '@careeros/notifications';

export interface EnrichedFollowUp {
  readonly id: string;
  readonly applicationId: string;
  readonly type: FollowUpType | undefined;
  readonly status: FollowUpStatus;
  readonly scheduledAt: Date;
  readonly message: string | undefined;
  readonly vacancyTitle: string;
  readonly companyName: string;
  /** Days since the application was submitted (or created, if never submitted). Null if the application is gone. */
  readonly daysSinceApplied: number | null;
}

export class FollowUpApplicationNotFoundError extends Error {
  constructor(id: string) {
    super(`Application '${id}' not found`);
    this.name = 'FollowUpApplicationNotFoundError';
  }
}

export class FollowUpNotAuthorizedError extends Error {
  constructor(id: string) {
    super(`Not authorized to access application '${id}'`);
    this.name = 'FollowUpNotAuthorizedError';
  }
}

export class FollowUpNotFoundError extends Error {
  constructor(id: string) {
    super(`Follow-up '${id}' not found`);
    this.name = 'FollowUpNotFoundError';
  }
}

export class FollowUpService {
  constructor(
    private readonly followUpRepository: FollowUpRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly vacancyRepository: VacancyRepository,
    private readonly companyRepository: CompanyRepository
  ) {}

  async schedule(
    applicationId: string,
    userId: string,
    scheduledAt: Date,
    message?: string,
    type?: FollowUpType
  ): Promise<FollowUp> {
    const application = await this.getOwnedApplication(applicationId, userId);
    const resolvedMessage = message ?? (await this.buildDefaultMessage(application));

    const followUp = FollowUp.create({
      id: createFollowUpId(crypto.randomUUID()),
      applicationId: application.id,
      scheduledAt,
      message: resolvedMessage,
      type,
    });

    await this.followUpRepository.save(followUp);
    return followUp;
  }

  async listForApplication(applicationId: string, userId: string): Promise<FollowUp[]> {
    const application = await this.getOwnedApplication(applicationId, userId);
    return this.followUpRepository.findByApplicationId(application.id);
  }

  /**
   * Scheduled by the application lifecycle (EPIC follow-up automation), not by the user — the
   * caller already owns `application`, so this skips the ownership round-trip `schedule()` does.
   * Silently no-ops if `scheduledAt` has already passed, or a pending/snoozed follow-up of the
   * same `type` already exists for this application (the duplicate-prevention rule).
   */
  async scheduleAutomatic(application: Application, type: FollowUpType, scheduledAt: Date): Promise<FollowUp | null> {
    if (scheduledAt <= new Date()) {
      return null;
    }

    const existing = await this.followUpRepository.findByApplicationId(application.id);
    const hasPendingOfType = existing.some(
      (f) => f.type === type && (f.status === 'pending' || f.status === 'snoozed')
    );
    if (hasPendingOfType) {
      return null;
    }

    const followUp = FollowUp.create({
      id: createFollowUpId(crypto.randomUUID()),
      applicationId: application.id,
      scheduledAt,
      message: await this.buildDefaultMessage(application),
      type,
    });

    await this.followUpRepository.save(followUp);
    return followUp;
  }

  /** Cancels every pending/snoozed follow-up for an application — used when it's rejected or archived. */
  async cancelPendingForApplication(applicationId: string): Promise<void> {
    const followUps = await this.followUpRepository.findByApplicationId(createApplicationId(applicationId));

    for (const followUp of followUps) {
      if (followUp.status === 'pending' || followUp.status === 'snoozed') {
        followUp.cancel();
        await this.followUpRepository.save(followUp);
      }
    }
  }

  async findByUserId(userId: string): Promise<FollowUp[]> {
    return this.followUpRepository.findByUserId(createUserId(userId));
  }

  /** All of a user's follow-ups, enriched with vacancy/company names and days-since-applied for the dashboard and digest. */
  async listEnrichedForUser(userId: string): Promise<EnrichedFollowUp[]> {
    const followUps = await this.followUpRepository.findByUserId(createUserId(userId));
    const enriched: EnrichedFollowUp[] = [];

    for (const followUp of followUps) {
      const application = await this.applicationRepository.findById(followUp.applicationId);
      if (!application) {
        continue;
      }

      enriched.push(await this.enrich(followUp, application));
    }

    return enriched;
  }

  /**
   * Same vacancy/company enrichment `listEnrichedForUser` applies per-item, exposed so the
   * create/reschedule/complete routes can return the same `EnrichedFollowUp` shape the list
   * route does, instead of the bare FollowUp fields — the two were drifting apart otherwise.
   */
  async enrich(followUp: FollowUp, prefetchedApplication?: Application | null): Promise<EnrichedFollowUp> {
    const application =
      prefetchedApplication !== undefined
        ? prefetchedApplication
        : await this.applicationRepository.findById(followUp.applicationId);
    const vacancy = application ? await this.vacancyRepository.findById(application.vacancyId) : null;
    const company = vacancy ? await this.companyRepository.findById(vacancy.companyId) : null;
    const referenceDate = application ? application.submittedAt ?? application.createdAt : null;

    return {
      id: followUp.id,
      applicationId: followUp.applicationId,
      type: followUp.type,
      status: followUp.status,
      scheduledAt: followUp.scheduledAt,
      message: followUp.message,
      vacancyTitle: vacancy?.title ?? 'Unknown position',
      companyName: company?.name ?? 'Unknown company',
      daysSinceApplied: referenceDate ? Math.floor((Date.now() - referenceDate.getTime()) / 86_400_000) : null,
    };
  }

  async snooze(followUpId: string, userId: string, until: Date): Promise<FollowUp> {
    const followUp = await this.getOwnedFollowUp(followUpId, userId);
    followUp.snooze(until);
    await this.followUpRepository.save(followUp);
    return followUp;
  }

  async complete(followUpId: string, userId: string): Promise<FollowUp> {
    const followUp = await this.getOwnedFollowUp(followUpId, userId);
    followUp.complete();
    await this.followUpRepository.save(followUp);
    return followUp;
  }

  async cancel(followUpId: string, userId: string): Promise<FollowUp> {
    const followUp = await this.getOwnedFollowUp(followUpId, userId);
    followUp.cancel();
    await this.followUpRepository.save(followUp);
    return followUp;
  }

  /** Follow-ups due for a reminder, across all users/workspaces. Used by the reminder sweep. */
  async findDue(before: Date = new Date()): Promise<FollowUp[]> {
    return this.followUpRepository.findDue(before);
  }

  private async buildDefaultMessage(application: Application): Promise<string> {
    const vacancy = await this.vacancyRepository.findById(application.vacancyId);
    const company = vacancy ? await this.companyRepository.findById(vacancy.companyId) : null;

    return buildDefaultFollowUpMessage({
      position: vacancy?.title,
      companyName: company?.name,
    });
  }

  private async getOwnedApplication(applicationId: string, userId: string): Promise<Application> {
    const application = await this.applicationRepository.findById(createApplicationId(applicationId));

    if (!application) {
      throw new FollowUpApplicationNotFoundError(applicationId);
    }

    if (application.userId !== userId) {
      throw new FollowUpNotAuthorizedError(applicationId);
    }

    return application;
  }

  private async getOwnedFollowUp(followUpId: string, userId: string): Promise<FollowUp> {
    const followUp = await this.followUpRepository.findById(createFollowUpId(followUpId));

    if (!followUp) {
      throw new FollowUpNotFoundError(followUpId);
    }

    await this.getOwnedApplication(followUp.applicationId, userId);
    return followUp;
  }
}

import type {
  Resume,
  ResumeRepository,
  ResumeId,
  ResumeListCriteria,
  User,
  UserRepository,
  UserId,
  Vacancy,
  VacancyRepository,
  VacancyId,
  CompanyId,
  VacancySource,
  Company,
  CompanyRepository,
  SaveVacancyOptions,
  SaveCompanyOptions,
  VacancyListCriteria,
  Application,
  ApplicationRepository,
  ApplicationId,
  ApplicationStatus,
  Recruiter,
  RecruiterRepository,
  RecruiterId,
  Communication,
  CommunicationRepository,
  CommunicationId,
  Interview,
  InterviewRepository,
  InterviewId,
  FollowUp,
  FollowUpRepository,
  FollowUpId,
  SearchProfile,
  SearchProfileRepository,
  SearchProfileId,
  SaveSearchProfileOptions,
  NotificationHistoryRepository,
  TelegramConnection,
  TelegramConnectionRepository,
  TelegramConnectionId,
  TelegramLinkingToken,
  TelegramLinkingTokenRepository,
  TelegramLinkingTokenId,
  StructuredResume,
  StructuredResumeRepository,
  UserVacancyInteractionRepository,
  UserVacancyInteractionData,
  InteractionAction,
} from '@careeros/career';
import type { Source as VacancySourceEntity, VacancySourceRepository, VacancySourceId, SaveVacancySourceOptions } from '@careeros/career';
import type { Email } from '@careeros/career';
import type { MatchResult, MatchResultRepository } from '@careeros/ai';
import type {
  AnalyticsEventRepository,
  AnalyticsEventQueryOptions,
  AnalyticsEventData,
  RecordAnalyticsEventInput,
  CareerInsightRepository,
  CareerInsightData,
  UpsertCareerInsightInput,
} from '@careeros/database';
import type { VacancyAnalysisJob, VacancyAnalysisQueue } from '../queues/vacancy-analysis-queue.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly records = new Map<string, User>();

  async findById(id: UserId): Promise<User | null> {
    return this.records.get(id) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    return [...this.records.values()].find((u) => u.email.value === email.value) ?? null;
  }

  async save(user: User): Promise<void> {
    this.records.set(user.id, user);
  }

  async delete(id: UserId): Promise<void> {
    this.records.delete(id);
  }

  async exists(id: UserId): Promise<boolean> {
    return this.records.has(id);
  }
}

export class InMemoryResumeRepository implements ResumeRepository {
  private readonly records = new Map<string, Resume>();

  async findById(id: ResumeId): Promise<Resume | null> {
    return this.records.get(id) ?? null;
  }

  async findByIds(ids: readonly ResumeId[]): Promise<Resume[]> {
    return ids.map((id) => this.records.get(id)).filter((r): r is Resume => r !== undefined);
  }

  async findByUserId(userId: UserId, criteria?: ResumeListCriteria): Promise<Resume[]> {
    return [...this.records.values()].filter((r) => {
      if (r.userId !== userId) return false;
      if (criteria?.status && r.status !== criteria.status) return false;
      if (criteria?.tag && !r.tags.includes(criteria.tag)) return false;
      return true;
    });
  }

  async findDefaultByUserId(userId: UserId): Promise<Resume | null> {
    const resumes = await this.findByUserId(userId);
    return resumes.find((r) => r.isDefault) ?? resumes[0] ?? null;
  }

  async save(resume: Resume): Promise<void> {
    this.records.set(resume.id, resume);
  }

  async delete(id: ResumeId): Promise<void> {
    this.records.delete(id);
  }

  async exists(id: ResumeId): Promise<boolean> {
    return this.records.has(id);
  }
}

export class InMemoryVacancyRepository implements VacancyRepository {
  private readonly records = new Map<string, Vacancy>();
  private readonly workspaceIds = new Map<string, string>();

  async findById(id: VacancyId): Promise<Vacancy | null> {
    return this.records.get(id) ?? null;
  }

  async findByIdForWorkspace(id: VacancyId, workspaceId: string): Promise<Vacancy | null> {
    if (this.workspaceIds.get(id) !== workspaceId) return null;
    return this.records.get(id) ?? null;
  }

  async findByIds(ids: readonly VacancyId[]): Promise<Vacancy[]> {
    return ids.map((id) => this.records.get(id)).filter((v): v is Vacancy => v !== undefined);
  }

  async findByCompanyId(companyId: CompanyId): Promise<Vacancy[]> {
    return [...this.records.values()].filter((v) => v.companyId === companyId);
  }

  async findByTitleAndCompany(title: string, companyId: CompanyId): Promise<Vacancy | null> {
    return (
      [...this.records.values()].find(
        (v) => v.title.toLowerCase() === title.toLowerCase() && v.companyId === companyId
      ) ?? null
    );
  }

  async findMany(criteria: VacancyListCriteria): Promise<{ vacancies: Vacancy[]; total: number }> {
    const query = criteria.query?.toLowerCase();
    const location = criteria.location?.toLowerCase();

    const filtered = [...this.records.values()].filter((v) => {
      if (this.workspaceIds.get(v.id) !== criteria.workspaceId) {
        return false;
      }
      if (query && !v.title.toLowerCase().includes(query) && !v.description.toLowerCase().includes(query)) {
        return false;
      }
      if (location) {
        const haystack = [v.location.city, v.location.country].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(location)) {
          return false;
        }
      }
      if (criteria.remote && v.location.workMode !== criteria.remote) {
        return false;
      }
      if (criteria.salaryMin !== undefined && (v.salary?.max ?? 0) < criteria.salaryMin) {
        return false;
      }
      if (criteria.salaryMax !== undefined && (v.salary?.min ?? 0) > criteria.salaryMax) {
        return false;
      }
      return true;
    });

    const sorted = filtered.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));

    return {
      vacancies: sorted.slice(criteria.offset, criteria.offset + criteria.limit),
      total: sorted.length,
    };
  }

  async save(vacancy: Vacancy, options: SaveVacancyOptions): Promise<void> {
    this.records.set(vacancy.id, vacancy);
    if (options.workspaceId) {
      this.workspaceIds.set(vacancy.id, options.workspaceId);
    }
  }

  async delete(id: VacancyId): Promise<void> {
    this.records.delete(id);
    this.workspaceIds.delete(id);
  }

  async exists(id: VacancyId): Promise<boolean> {
    return this.records.has(id);
  }

  async getStats(workspaceId: string): Promise<import('@careeros/career').VacancyStats> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const all = [...this.records.values()].filter((v) => this.workspaceIds.get(v.id) === workspaceId);
    const newToday = all.filter((v) => v.createdAt >= today).length;
    return {
      totalJobs: all.length,
      newToday,
      sources: [],
      totalSources: 0,
      lastSyncAt: null,
    };
  }
}

export class InMemoryVacancySourceRepository implements VacancySourceRepository {
  private readonly records = new Map<string, VacancySourceEntity>();

  async findById(id: VacancySourceId): Promise<VacancySourceEntity | null> {
    return this.records.get(id) ?? null;
  }

  async findByVacancyId(vacancyId: VacancyId): Promise<VacancySourceEntity[]> {
    return [...this.records.values()].filter((s) => s.vacancyId === vacancyId);
  }

  async findByVacancyIds(vacancyIds: readonly VacancyId[]): Promise<Map<string, VacancySourceEntity[]>> {
    const idSet = new Set<string>(vacancyIds);
    const byId = new Map<string, VacancySourceEntity[]>();
    for (const source of this.records.values()) {
      if (!idSet.has(source.vacancyId)) continue;
      const existing = byId.get(source.vacancyId);
      if (existing) {
        existing.push(source);
      } else {
        byId.set(source.vacancyId, [source]);
      }
    }
    return byId;
  }

  async findByVacancyIdAndProvider(
    vacancyId: VacancyId,
    providerId: VacancySource,
    externalId: string
  ): Promise<VacancySourceEntity | null> {
    return (
      [...this.records.values()].find(
        (s) => s.vacancyId === vacancyId && s.providerId === providerId && s.externalId === externalId
      ) ?? null
    );
  }

  async findByProviderAndExternalId(
    providerId: VacancySource,
    externalId: string
  ): Promise<VacancySourceEntity | null> {
    return (
      [...this.records.values()].find(
        (s) => s.providerId === providerId && s.externalId === externalId
      ) ?? null
    );
  }

  async save(source: VacancySourceEntity, _options?: SaveVacancySourceOptions): Promise<void> {
    this.records.set(source.id, source);
  }

  async delete(id: VacancySourceId): Promise<void> {
    this.records.delete(id);
  }

  async exists(id: VacancySourceId): Promise<boolean> {
    return this.records.has(id);
  }

  async countByVacancyId(vacancyId: VacancyId): Promise<number> {
    return [...this.records.values()].filter((s) => s.vacancyId === vacancyId).length;
  }
}

export class InMemoryCompanyRepository implements CompanyRepository {
  private readonly records = new Map<string, Company>();
  private readonly workspaceIds = new Map<string, string>();

  async findById(id: CompanyId): Promise<Company | null> {
    return this.records.get(id) ?? null;
  }

  async findByIdForWorkspace(id: CompanyId, workspaceId: string): Promise<Company | null> {
    if (this.workspaceIds.get(id) !== workspaceId) return null;
    return this.records.get(id) ?? null;
  }

  async findByIds(ids: readonly CompanyId[]): Promise<Company[]> {
    return ids.map((id) => this.records.get(id)).filter((c): c is Company => c !== undefined);
  }

  async findByName(name: string): Promise<Company | null> {
    return [...this.records.values()].find((c) => c.name === name) ?? null;
  }

  async save(company: Company, options: SaveCompanyOptions): Promise<void> {
    this.records.set(company.id, company);
    if (options.workspaceId) {
      this.workspaceIds.set(company.id, options.workspaceId);
    }
  }

  async delete(id: CompanyId): Promise<void> {
    this.records.delete(id);
    this.workspaceIds.delete(id);
  }

  async exists(id: CompanyId): Promise<boolean> {
    return this.records.has(id);
  }
}

export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly records = new Map<string, Application>();

  async findById(id: ApplicationId): Promise<Application | null> {
    return this.records.get(id) ?? null;
  }

  async findByUserId(userId: UserId): Promise<Application[]> {
    return [...this.records.values()].filter((a) => a.userId === userId);
  }

  async findByUserIdAndStatus(userId: UserId, status: ApplicationStatus): Promise<Application[]> {
    return (await this.findByUserId(userId)).filter((a) => a.status === status);
  }

  async findByVacancyId(vacancyId: VacancyId): Promise<Application[]> {
    return [...this.records.values()].filter((a) => a.vacancyId === vacancyId);
  }

  async findByUserIdAndVacancyId(userId: UserId, vacancyId: VacancyId): Promise<Application | null> {
    return (
      [...this.records.values()].find((a) => a.userId === userId && a.vacancyId === vacancyId) ?? null
    );
  }

  async save(application: Application): Promise<void> {
    this.records.set(application.id, application);
  }

  async delete(id: ApplicationId): Promise<void> {
    this.records.delete(id);
  }

  async exists(id: ApplicationId): Promise<boolean> {
    return this.records.has(id);
  }
}

export class InMemoryRecruiterRepository implements RecruiterRepository {
  private readonly records = new Map<string, Recruiter>();
  private readonly workspaceByRecruiterId = new Map<string, string>();

  async findById(id: RecruiterId): Promise<Recruiter | null> {
    return this.records.get(id) ?? null;
  }

  async findByIdForWorkspace(id: RecruiterId, workspaceId: string): Promise<Recruiter | null> {
    const recruiter = this.records.get(id);
    if (!recruiter || this.workspaceByRecruiterId.get(recruiter.id) !== workspaceId) {
      return null;
    }
    return recruiter;
  }

  async findByCompanyId(companyId: CompanyId): Promise<Recruiter[]> {
    return [...this.records.values()].filter((r) => r.companyId === companyId);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Recruiter[]> {
    return [...this.records.values()].filter(
      (r) => this.workspaceByRecruiterId.get(r.id) === workspaceId
    );
  }

  async save(recruiter: Recruiter, options: { workspaceId?: string } = {}): Promise<void> {
    this.records.set(recruiter.id, recruiter);
    if (options.workspaceId) {
      this.workspaceByRecruiterId.set(recruiter.id, options.workspaceId);
    }
  }

  async delete(id: RecruiterId): Promise<void> {
    this.records.delete(id);
    this.workspaceByRecruiterId.delete(id);
  }

  async exists(id: RecruiterId): Promise<boolean> {
    return this.records.has(id);
  }
}

export class InMemoryCommunicationRepository implements CommunicationRepository {
  private readonly records = new Map<string, Communication>();

  async findById(id: CommunicationId): Promise<Communication | null> {
    return this.records.get(id) ?? null;
  }

  async findByApplicationId(applicationId: ApplicationId): Promise<Communication[]> {
    return [...this.records.values()]
      .filter((c) => c.applicationId === applicationId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }

  async save(communication: Communication): Promise<void> {
    this.records.set(communication.id, communication);
  }

  async delete(id: CommunicationId): Promise<void> {
    this.records.delete(id);
  }
}

export class InMemoryInterviewRepository implements InterviewRepository {
  private readonly records = new Map<string, Interview>();

  async findById(id: InterviewId): Promise<Interview | null> {
    return this.records.get(id) ?? null;
  }

  async findByApplicationId(applicationId: ApplicationId): Promise<Interview[]> {
    return [...this.records.values()].filter((i) => i.applicationId === applicationId);
  }

  async findUpcomingByApplicationId(applicationId: ApplicationId): Promise<Interview[]> {
    const now = new Date();
    return (await this.findByApplicationId(applicationId)).filter(
      (i) => !i.isCompleted && i.scheduledAt > now
    );
  }

  async save(interview: Interview): Promise<void> {
    this.records.set(interview.id, interview);
  }

  async delete(id: InterviewId): Promise<void> {
    this.records.delete(id);
  }

  async exists(id: InterviewId): Promise<boolean> {
    return this.records.has(id);
  }
}

export class InMemoryFollowUpRepository implements FollowUpRepository {
  private readonly records = new Map<string, FollowUp>();

  /** Optional — only needed by findByUserId, which joins through Application the way the Prisma repository joins through the DB relation. */
  constructor(private readonly applicationRepository?: Pick<ApplicationRepository, 'findById'>) {}

  async findById(id: FollowUpId): Promise<FollowUp | null> {
    return this.records.get(id) ?? null;
  }

  async findByApplicationId(applicationId: ApplicationId): Promise<FollowUp[]> {
    return [...this.records.values()].filter((f) => f.applicationId === applicationId);
  }

  async findByUserId(userId: UserId): Promise<FollowUp[]> {
    if (!this.applicationRepository) {
      throw new Error('InMemoryFollowUpRepository.findByUserId requires an applicationRepository to join through');
    }

    const matches: FollowUp[] = [];
    for (const followUp of this.records.values()) {
      const application = await this.applicationRepository.findById(followUp.applicationId);
      if (application?.userId === userId) {
        matches.push(followUp);
      }
    }

    return matches;
  }

  async findDue(before: Date): Promise<FollowUp[]> {
    return [...this.records.values()].filter(
      (f) => (f.status === 'pending' || f.status === 'snoozed') && f.scheduledAt <= before
    );
  }

  async save(followUp: FollowUp): Promise<void> {
    this.records.set(followUp.id, followUp);
  }

  async delete(id: FollowUpId): Promise<void> {
    this.records.delete(id);
  }
}

export class InMemorySearchProfileRepository implements SearchProfileRepository {
  private readonly records = new Map<string, SearchProfile>();

  async findById(id: SearchProfileId): Promise<SearchProfile | null> {
    return this.records.get(id) ?? null;
  }

  async findByUserId(userId: UserId): Promise<SearchProfile[]> {
    return [...this.records.values()].filter((p) => p.userId === userId);
  }

  async findActiveByUserId(userId: UserId): Promise<SearchProfile | null> {
    return (await this.findByUserId(userId)).find((p) => p.isActive) ?? null;
  }

  async save(profile: SearchProfile, _options: SaveSearchProfileOptions): Promise<void> {
    this.records.set(profile.id, profile);
  }

  async delete(id: SearchProfileId): Promise<void> {
    this.records.delete(id);
  }

  async exists(id: SearchProfileId): Promise<boolean> {
    return this.records.has(id);
  }
}

export class InMemoryMatchResultRepository implements MatchResultRepository {
  private readonly records = new Map<string, MatchResult>();

  async save(matchResult: MatchResult): Promise<void> {
    // Mirrors the DB's upsert-by-(searchProfileId, vacancyId) semantics: a
    // recomputed analysis for the same pair replaces the prior row instead of
    // living alongside it under a different key.
    const existingKey = [...this.records.entries()].find(
      ([, m]) => m.searchProfileId === matchResult.searchProfileId && m.vacancyId === matchResult.vacancyId
    )?.[0];
    if (existingKey && existingKey !== matchResult.id) {
      this.records.delete(existingKey);
    }
    this.records.set(matchResult.id, matchResult);
  }

  async findById(id: string): Promise<MatchResult | null> {
    return this.records.get(id) ?? null;
  }

  async findBySearchProfileIdAndVacancyId(searchProfileId: string, vacancyId: string): Promise<MatchResult | null> {
    return (
      [...this.records.values()].find(
        (m) => m.searchProfileId === searchProfileId && m.vacancyId === vacancyId
      ) ?? null
    );
  }

  async findByUserId(userId: string): Promise<readonly MatchResult[]> {
    return [...this.records.values()].filter((m) => m.userId === userId);
  }

  async findBySearchProfileId(searchProfileId: string): Promise<readonly MatchResult[]> {
    return [...this.records.values()].filter((m) => m.searchProfileId === searchProfileId);
  }

  async findByVacancyIds(vacancyIds: readonly string[]): Promise<readonly MatchResult[]> {
    const set = new Set(vacancyIds);
    return [...this.records.values()].filter((m) => set.has(m.vacancyId));
  }
}

export class InMemoryAnalyticsEventRepository implements AnalyticsEventRepository {
  private readonly events: AnalyticsEventData[] = [];
  private counter = 0;

  async record(input: RecordAnalyticsEventInput): Promise<void> {
    this.events.push({
      id: `event-${++this.counter}`,
      userId: input.userId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
      occurredAt: new Date(),
    });
  }

  async recordMany(inputs: readonly RecordAnalyticsEventInput[]): Promise<void> {
    for (const input of inputs) {
      await this.record(input);
    }
  }

  async findByUserId(userId: string, options?: AnalyticsEventQueryOptions): Promise<AnalyticsEventData[]> {
    return this.events
      .filter((e) => e.userId === userId)
      .filter((e) => !options?.eventType || e.eventType === options.eventType)
      .filter((e) => !options?.entityType || e.entityType === options.entityType)
      .filter((e) => !options?.since || e.occurredAt >= options.since)
      .filter((e) => !options?.until || e.occurredAt <= options.until)
      .slice(0, options?.limit ?? 1000);
  }

  async countDistinctEntities(
    userId: string,
    eventType: string,
    options?: { since?: Date; until?: Date }
  ): Promise<number> {
    const matches = await this.findByUserId(userId, { eventType, since: options?.since, until: options?.until, limit: Number.MAX_SAFE_INTEGER });
    return new Set(matches.map((e) => e.entityId)).size;
  }
}

export class InMemoryCareerInsightRepository implements CareerInsightRepository {
  private readonly rows = new Map<string, CareerInsightData>();
  private counter = 0;

  private key(userId: string, insightType: string): string {
    return `${userId}:${insightType}`;
  }

  async get(userId: string, insightType: string): Promise<CareerInsightData | null> {
    return this.rows.get(this.key(userId, insightType)) ?? null;
  }

  async upsert(input: UpsertCareerInsightInput): Promise<void> {
    this.rows.set(this.key(input.userId, input.insightType), {
      id: `insight-${++this.counter}`,
      userId: input.userId,
      insightType: input.insightType,
      data: input.data,
      computedAt: new Date(),
      validUntil: input.validUntil,
    });
  }
}

export class InMemoryNotificationHistoryRepository implements NotificationHistoryRepository {
  private readonly notified = new Set<string>();

  async filterUnnotified(
    userId: UserId,
    matchResultIds: readonly string[],
    channel: string
  ): Promise<readonly string[]> {
    return matchResultIds.filter((id) => !this.notified.has(this.key(userId, id, channel)));
  }

  async recordNotified(userId: UserId, matchResultIds: readonly string[], channel: string): Promise<void> {
    for (const id of matchResultIds) {
      this.notified.add(this.key(userId, id, channel));
    }
  }

  private key(userId: string, matchResultId: string, channel: string): string {
    return `${userId}:${channel}:${matchResultId}`;
  }
}

export class InMemoryTelegramConnectionRepository implements TelegramConnectionRepository {
  private readonly records = new Map<string, TelegramConnection>();

  async findById(id: TelegramConnectionId): Promise<TelegramConnection | null> {
    return this.records.get(id) ?? null;
  }

  async findByUserId(userId: UserId): Promise<TelegramConnection | null> {
    return [...this.records.values()].find((c) => c.userId === userId) ?? null;
  }

  async findByTelegramChatId(telegramChatId: string): Promise<TelegramConnection | null> {
    return [...this.records.values()].find((c) => c.telegramChatId === telegramChatId) ?? null;
  }

  async save(connection: TelegramConnection): Promise<void> {
    this.records.set(connection.id, connection);
  }

  async delete(id: TelegramConnectionId): Promise<void> {
    this.records.delete(id);
  }
}

export class InMemoryTelegramLinkingTokenRepository implements TelegramLinkingTokenRepository {
  private readonly records = new Map<string, TelegramLinkingToken>();

  async findById(id: TelegramLinkingTokenId): Promise<TelegramLinkingToken | null> {
    return this.records.get(id) ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<TelegramLinkingToken | null> {
    return [...this.records.values()].find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async save(token: TelegramLinkingToken): Promise<void> {
    this.records.set(token.id, token);
  }
}

export class InMemoryVacancyAnalysisQueue implements VacancyAnalysisQueue {
  readonly enqueued: VacancyAnalysisJob[] = [];

  async enqueue(jobs: readonly VacancyAnalysisJob[]): Promise<void> {
    this.enqueued.push(...jobs);
  }
}

export class InMemoryUserVacancyInteractionRepository implements UserVacancyInteractionRepository {
  private readonly records: UserVacancyInteractionData[] = [];
  private counter = 0;

  constructor(private readonly vacancyRepository?: InMemoryVacancyRepository) {}

  async record(input: { userId: UserId; vacancyId: VacancyId; action: InteractionAction }): Promise<void> {
    const existing = this.records.find(
      (r) => r.userId === input.userId && r.vacancyId === input.vacancyId && r.action === input.action,
    );
    if (!existing) {
      this.records.push({
        id: `interaction-${++this.counter}`,
        userId: input.userId,
        vacancyId: input.vacancyId,
        action: input.action,
        createdAt: new Date(),
      });
    }
  }

  async findByUserId(
    userId: UserId,
    options?: { action?: InteractionAction; since?: Date; limit?: number },
  ): Promise<UserVacancyInteractionData[]> {
    let filtered = this.records.filter((r) => r.userId === userId);
    if (options?.action) filtered = filtered.filter((r) => r.action === options.action);
    const since = options?.since;
    if (since) filtered = filtered.filter((r) => r.createdAt >= since);
    return filtered.slice(0, options?.limit ?? 1000);
  }

  async findByUserIdAndVacancyId(userId: UserId, vacancyId: VacancyId): Promise<UserVacancyInteractionData[]> {
    return this.records.filter((r) => r.userId === userId && r.vacancyId === vacancyId);
  }

  async countByAction(userId: UserId, action: InteractionAction, options?: { since?: Date }): Promise<number> {
    return this.records.filter(
      (r) => r.userId === userId && r.action === action && (!options?.since || r.createdAt >= options.since),
    ).length;
  }

  async getTechnologiesFromInteractedVacancies(
    userId: UserId,
    action: InteractionAction,
    options?: { since?: Date; limit?: number },
  ): Promise<string[]> {
    const interactions = await this.findByUserId(userId, { action, since: options?.since, limit: options?.limit });
    const techSet = new Set<string>();
    for (const interaction of interactions) {
      const vacancy = await this.vacancyRepository?.findById(interaction.vacancyId);
      if (vacancy) {
        for (const tech of vacancy.technologies) {
          techSet.add(tech.name.toLowerCase());
        }
      }
    }
    return [...techSet];
  }
}

export class InMemoryStructuredResumeRepository implements StructuredResumeRepository {
  private readonly records = new Map<string, StructuredResume>();

  async findByResumeId(resumeId: ResumeId): Promise<StructuredResume | null> {
    for (const record of this.records.values()) {
      if (record.resumeId === resumeId) {
        return record;
      }
    }
    return null;
  }

  async upsert(structuredResume: StructuredResume): Promise<void> {
    this.records.set(structuredResume.id, structuredResume);
  }
}

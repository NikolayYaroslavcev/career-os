import type { ProviderRegistry, Logger, MetricsCollector, HealthState } from '@careeros/providers';
import type { VacancyRepository, VacancySourceRepository, CompanyRepository, VacancySource, VacancyId, Company } from '@careeros/career';
import { Vacancy, Source as VacancySourceEntity, createVacancySourceId, createVacancyId, createCompanyId, Location, Salary, Technology, ExperienceLevel } from '@careeros/career';
import type { NormalizedVacancy } from '@careeros/providers';
import { inferProviderType, shouldOverride } from '../config/source-priority.js';

interface ProviderConfigRepo {
  isProviderSyncEnabled(providerId: string): Promise<boolean>;
}

export interface SyncSchedule {
  readonly providerId: string;
  readonly intervalMs: number;
  readonly enabled: boolean;
}

export interface SyncStatus {
  readonly providerId: string;
  readonly lastSyncAt: Date | null;
  readonly lastSyncResult: 'success' | 'failed' | 'pending';
  readonly nextSyncAt: Date | null;
  readonly totalJobsSynced: number;
  readonly lastError?: string;
  /**
   * Live operational state, derived here from actual sync outcomes.
   * This is the single source of truth for provider health — ProviderRegistry's
   * ProviderState is a boot-time snapshot only and is never updated after
   * registration, so it must not be read as live state (see provider-registry.ts).
   */
  readonly health: HealthState;
  readonly importedCount: number;
  readonly failedCount: number;
  readonly consecutiveFailures: number;
}

/** Matches the unhealthyThreshold used by HealthMonitorConfig / DefaultSyncStrategy's circuit breaker. */
const UNHEALTHY_AFTER_CONSECUTIVE_FAILURES = 3;

function deriveHealth(consecutiveFailures: number): HealthState {
  if (consecutiveFailures >= UNHEALTHY_AFTER_CONSECUTIVE_FAILURES) return 'unhealthy';
  if (consecutiveFailures > 0) return 'degraded';
  return 'healthy';
}

export interface SyncAllResult {
  readonly results: Array<{
    providerId: string;
    status: 'success' | 'failed';
    jobsSynced: number;
    error?: string;
    durationMs: number;
  }>;
  readonly totalDurationMs: number;
}

const DEFAULT_SYNC_INTERVALS: Record<string, number> = {
  remote_ok: 60 * 60 * 1000,
  hh: 60 * 60 * 1000,
  adzuna: 60 * 60 * 1000,
  remotive: 60 * 60 * 1000,
  himalayas: 2 * 60 * 60 * 1000,
  arbeitnow: 60 * 60 * 1000,
  jobicy: 60 * 60 * 1000,
  we_work_remotely: 2 * 60 * 60 * 1000,
  working_nomads: 2 * 60 * 60 * 1000,
  nodesk: 2 * 60 * 60 * 1000,
  hn_hiring: 24 * 60 * 60 * 1000,
  habr_career: 2 * 60 * 60 * 1000,
  greenhouse: 60 * 60 * 1000,
  lever: 60 * 60 * 1000,
  ashby: 60 * 60 * 1000,
  workday: 60 * 60 * 1000,
  teamtailor: 60 * 60 * 1000,
  smartrecruiters: 60 * 60 * 1000,
  recruitee: 60 * 60 * 1000,
  comeet: 60 * 60 * 1000,
};

function statusKey(workspaceId: string, providerId: string): string {
  return `${workspaceId}::${providerId}`;
}

export class SyncSchedulerService {
  private intervals = new Map<string, ReturnType<typeof setInterval>>();
  private syncStatuses = new Map<string, SyncStatus>();

  private providerConfigRepo: ProviderConfigRepo | null = null;

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly vacancyRepository: VacancyRepository,
    private readonly vacancySourceRepository: VacancySourceRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector,
    private readonly defaultIntervalMs: number = 60 * 60 * 1000,
    providerConfigRepo?: ProviderConfigRepo,
  ) {
    this.providerConfigRepo = providerConfigRepo ?? null;
  }

  setProviderConfigRepo(repo: ProviderConfigRepo): void {
    this.providerConfigRepo = repo;
  }

  private async isProviderSyncDisabled(providerId: string): Promise<boolean> {
    if (!this.providerConfigRepo) return false;
    try {
      return !(await this.providerConfigRepo.isProviderSyncEnabled(providerId));
    } catch {
      return false;
    }
  }

  async startAll(workspaceId: string): Promise<void> {
    const providers = this.registry.getAll();
    for (const provider of providers) {
      const disabled = await this.isProviderSyncDisabled(provider.info.id);
      if (disabled) {
        this.logger.info('Skipping disabled provider', { providerId: provider.info.id });
        continue;
      }
      const intervalMs = DEFAULT_SYNC_INTERVALS[provider.info.id] ?? this.defaultIntervalMs;
      this.startProvider(provider.info.id, intervalMs, workspaceId);
    }
    this.logger.info('Sync scheduler started for all providers', { providerCount: providers.length });
  }

  startProvider(providerId: string, intervalMs: number, workspaceId: string): void {
    if (this.intervals.has(providerId)) {
      this.stopProvider(providerId);
    }

    this.syncStatuses.set(statusKey(workspaceId, providerId), {
      providerId,
      lastSyncAt: null,
      lastSyncResult: 'pending',
      nextSyncAt: new Date(Date.now() + intervalMs),
      totalJobsSynced: 0,
      health: 'unknown',
      importedCount: 0,
      failedCount: 0,
      consecutiveFailures: 0,
    });

    const interval = setInterval(async () => {
      await this.syncProvider(providerId, workspaceId);
    }, intervalMs);

    this.intervals.set(providerId, interval);
    this.logger.info('Sync scheduled for provider', { providerId, intervalMs });

    // setInterval only fires after the first full intervalMs elapses (up to
    // 24h for some providers) — without this, a freshly started server shows
    // no vacancies for that provider until the interval passes, forcing a
    // manual sync. Kick off the first sync immediately instead.
    void this.syncProvider(providerId, workspaceId);
  }

  stopProvider(providerId: string): void {
    const interval = this.intervals.get(providerId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(providerId);
    }
  }

  stopAll(): void {
    for (const [providerId] of this.intervals) {
      this.stopProvider(providerId);
    }
  }

  async syncProvider(providerId: string, workspaceId: string): Promise<{ status: 'success' | 'failed'; jobsSynced: number; error?: string; durationMs: number }> {
    const startTime = Date.now();

    const disabled = await this.isProviderSyncDisabled(providerId);
    if (disabled) {
      return {
        status: 'failed',
        jobsSynced: 0,
        error: `Provider "${providerId}" is disabled. Enable it in Provider Settings to sync.`,
        durationMs: 0,
      };
    }

    try {
      const provider = this.registry.get(providerId);
      const result = await provider.sync();

      if (!result.ok) {
        throw new Error(result.message ?? 'Sync failed');
      }

      let jobsSynced = 0;
      for (const normalized of result.data.imported) {
        const synced = await this.ingestVacancy(normalized, workspaceId);
        if (synced) jobsSynced++;
      }

      const durationMs = Date.now() - startTime;
      const key = statusKey(workspaceId, providerId);
      const prev = this.syncStatuses.get(key);
      this.syncStatuses.set(key, {
        providerId,
        lastSyncAt: new Date(),
        lastSyncResult: 'success',
        nextSyncAt: new Date(Date.now() + (DEFAULT_SYNC_INTERVALS[providerId] ?? this.defaultIntervalMs)),
        totalJobsSynced: (prev?.totalJobsSynced ?? 0) + jobsSynced,
        health: deriveHealth(0),
        importedCount: (prev?.importedCount ?? 0) + result.data.imported.length,
        failedCount: (prev?.failedCount ?? 0) + (result.data.metrics?.failed ?? 0),
        consecutiveFailures: 0,
      });

      this.metrics.incrementCounter('careeros.sync.success', 1, { providerId });
      this.logger.info('Provider sync completed', { providerId, jobsSynced, durationMs });

      return { status: 'success', jobsSynced, durationMs };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      const key = statusKey(workspaceId, providerId);
      const prev = this.syncStatuses.get(key);
      const consecutiveFailures = (prev?.consecutiveFailures ?? 0) + 1;

      this.syncStatuses.set(key, {
        providerId,
        lastSyncAt: new Date(),
        lastSyncResult: 'failed',
        nextSyncAt: new Date(Date.now() + (DEFAULT_SYNC_INTERVALS[providerId] ?? this.defaultIntervalMs)),
        totalJobsSynced: prev?.totalJobsSynced ?? 0,
        lastError: message,
        health: deriveHealth(consecutiveFailures),
        importedCount: prev?.importedCount ?? 0,
        failedCount: prev?.failedCount ?? 0,
        consecutiveFailures,
      });

      this.metrics.incrementCounter('careeros.sync.failed', 1, { providerId });
      this.logger.error('Provider sync failed', error instanceof Error ? error : undefined, { providerId });

      return { status: 'failed', jobsSynced: 0, error: message, durationMs };
    }
  }

  async syncAll(workspaceId: string): Promise<SyncAllResult> {
    const startTime = Date.now();
    const providers = this.registry.getAll();

    const results = await Promise.allSettled(
      providers.map(async (provider) => {
        const result = await this.syncProvider(provider.info.id, workspaceId);
        return { providerId: provider.info.id, ...result };
      })
    );

    const syncResults = results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { providerId: 'unknown', status: 'failed' as const, jobsSynced: 0, error: 'Promise rejected', durationMs: 0 }
    );

    return {
      results: syncResults,
      totalDurationMs: Date.now() - startTime,
    };
  }

  getStatuses(workspaceId: string): SyncStatus[] {
    const prefix = `${workspaceId}::`;
    return Array.from(this.syncStatuses.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([, status]) => status);
  }

  getStatus(workspaceId: string, providerId: string): SyncStatus | undefined {
    return this.syncStatuses.get(statusKey(workspaceId, providerId));
  }

  /**
   * Ingest a normalized vacancy into the system.
   * Handles multi-source deduplication:
   * 1. Find canonical vacancy by title + company
   * 2. If not found, create Vacancy + VacancySource
   * 3. If found, attach VacancySource if missing, merge data if higher priority
   */
  private async ingestVacancy(normalized: NormalizedVacancy, workspaceId: string): Promise<boolean> {
    const providerId = normalized.source as VacancySource;
    const externalId = normalized.sourceId;

    const existingSource = await this.vacancySourceRepository.findByProviderAndExternalId(providerId, externalId);
    if (existingSource) {
      existingSource.updateLastSeen();
      await this.vacancySourceRepository.save(existingSource);
      return false;
    }

    const company = await this.findOrCreateCompany(normalized.companyName, workspaceId);
    const canonical = await this.vacancyRepository.findByTitleAndCompany(normalized.title, company.id);

    if (canonical) {
      const source = VacancySourceEntity.create({
        id: createVacancySourceId(crypto.randomUUID()),
        vacancyId: canonical.id,
        providerType: inferProviderType(providerId),
        providerId,
        externalId,
        sourceUrl: normalized.url,
        isPrimary: false,
      });
      await this.vacancySourceRepository.save(source, { workspaceId });

      const existingSources = await this.vacancySourceRepository.findByVacancyId(canonical.id);
      if (existingSources.length === 1) {
        source.setPrimary();
        await this.vacancySourceRepository.save(source);
      }

      await this.mergeVacancyData(canonical.id, normalized, providerId);
      return true;
    }

    const vacancy = this.createVacancy(normalized, company.id);
    await this.vacancyRepository.save(vacancy, { workspaceId });

    const source = VacancySourceEntity.create({
      id: createVacancySourceId(crypto.randomUUID()),
      vacancyId: vacancy.id,
      providerType: inferProviderType(providerId),
      providerId,
      externalId,
      sourceUrl: normalized.url,
      isPrimary: true,
    });
    await this.vacancySourceRepository.save(source, { workspaceId });

    return true;
  }

  private async mergeVacancyData(
    vacancyId: VacancyId,
    normalized: NormalizedVacancy,
    newSource: VacancySource,
  ): Promise<void> {
    const vacancy = await this.vacancyRepository.findById(vacancyId);
    if (!vacancy) return;

    const existingSources = await this.vacancySourceRepository.findByVacancyId(vacancyId);
    const primarySource = existingSources.find((s) => s.isPrimary) ?? existingSources[0];

    if (!primarySource || shouldOverride(primarySource.providerId, newSource)) {
      if (normalized.salary && (!vacancy.salary || (normalized.salary.max ?? 0) > (vacancy.salary.max ?? 0))) {
        vacancy.updateSalary(Salary.create(
          normalized.salary.min ?? normalized.salary.max ?? 0,
          normalized.salary.max ?? normalized.salary.min ?? 0,
          (normalized.salary.originalCurrency ?? 'USD') as 'USD' | 'EUR' | 'GBP' | 'UAH' | 'RUB',
          'monthly'
        ));
      }

      if (normalized.location.raw && normalized.location.raw !== vacancy.location.city) {
        vacancy.updateLocation(Location.create({
          city: normalized.location.city,
          country: normalized.location.country,
          workMode: normalized.remote.level === 'remote_only' ? 'remote' : normalized.remote.level === 'hybrid' ? 'hybrid' : 'onsite',
          isRelocationPossible: false,
        }));
      }

      await this.vacancyRepository.save(vacancy, { workspaceId: '' });
    }
  }

  private createVacancy(normalized: NormalizedVacancy, companyId: string): Vacancy {
    return Vacancy.create({
      id: createVacancyId(crypto.randomUUID()),
      title: normalized.title,
      description: normalized.description,
      companyId: createCompanyId(companyId),
      location: Location.create({
        city: normalized.location.city,
        country: normalized.location.country,
        workMode: normalized.remote.level === 'remote_only' ? 'remote' : normalized.remote.level === 'hybrid' ? 'hybrid' : 'onsite',
        isRelocationPossible: false,
      }),
      experienceLevel: this.mapExperienceLevel(normalized.experienceLevel),
      technologies: normalized.technologies.map((name) => Technology.create(name, 'other')),
      requirements: [],
      salary: normalized.salary?.min !== undefined || normalized.salary?.max !== undefined
        ? Salary.create(normalized.salary.min ?? normalized.salary.max ?? 0, normalized.salary.max ?? normalized.salary.min ?? 0, (normalized.salary.originalCurrency ?? 'USD') as 'USD' | 'EUR' | 'GBP' | 'UAH' | 'RUB', 'monthly')
        : undefined,
    });
  }

  private async findOrCreateCompany(name: string, workspaceId: string): Promise<Company> {
    const existing = await this.companyRepository.findByName(name);
    if (existing) return existing;
    const { Company } = await import('@careeros/career');
    const company = Company.create({ id: createCompanyId(crypto.randomUUID()), name });
    await this.companyRepository.save(company, { workspaceId });
    return company;
  }

  private mapExperienceLevel(level: string | undefined): ExperienceLevel {
    const known = Object.values(ExperienceLevel);
    if (level && known.includes(level as ExperienceLevel)) return level as ExperienceLevel;
    return ExperienceLevel.MIDDLE;
  }
}

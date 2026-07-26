import {
  Vacancy,
  Source as VacancySourceEntity,
  Company,
  createVacancyId,
  createVacancySourceId,
  createCompanyId,
  Location,
  Salary,
  Technology,
  ExperienceLevel,
} from '@careeros/career';
import type { SearchProfile, VacancyRepository, VacancySourceRepository, CompanyRepository, VacancySource } from '@careeros/career';
import { inferProviderType } from '../config/source-priority.js';
import { DeduplicationEngine } from '@careeros/providers';
import type {
  ProviderRegistry,
  ProviderJob,
  SearchCriteria,
  NormalizedVacancy,
  RemoteLevel,
  Logger,
  MetricsCollector,
  ExperienceLevel as ProviderExperienceLevel,
} from '@careeros/providers';
import type { ProviderDiagnosticsService } from './provider-diagnostics-service.js';

// Fallback defaults only used if a caller omits the config-sourced constructor
// args below (e.g. older tests) — production wiring always passes explicit
// values from Config (PROVIDER_SEARCH_LIMIT / PROVIDER_TIMEOUT_MS / MIN_RELEVANCE_SCORE).
const DEFAULT_SEARCH_LIMIT = 50;
const MIN_RELEVANCE_SCORE = 1;
const DEFAULT_PROVIDER_TIMEOUT_MS = 15_000;

export interface ProviderSearchProviderStats {
  readonly providerId: string;
  readonly ok: boolean;
  readonly fetched: number;
  readonly durationMs: number;
  readonly timedOut?: boolean;
  readonly error?: string;
  /** Raw jobs the fetcher returned, before mapping/normalization/validation. */
  readonly rawFetchedCount?: number;
  /** Passed Normalizer.validate() — same population `fetched` already reports. */
  readonly normalizedCount?: number;
  /** Failed Normalizer.validate() — previously discarded entirely (see DefaultProviderJob.search()'s `normalization.failed`). */
  readonly parseFailureCount?: number;
  /** The specific vacancies that failed, for per-vacancy search diagnostics. */
  readonly parseFailures?: readonly { readonly sourceId: string; readonly reason: string }[];
}

export interface ProviderSearchStats {
  readonly providerIds: readonly string[];
  readonly fetched: number;
  readonly persisted: number;
  readonly reused: number;
  readonly durationMs: number;
  /** Fetch + normalize + dedup + relevance-filter, excluding the persistence loop below. */
  readonly fetchDurationMs: number;
  /** The per-vacancy persist loop only — isolated so callers can tell fetch latency apart from DB latency. */
  readonly persistDurationMs: number;
  /** Cross-provider survivors after DeduplicationEngine — previously only logged, not returned. */
  readonly deduplicatedCount: number;
  /** Survivors after the local keyword relevance filter — previously only logged, not returned. */
  readonly filteredCount: number;
  /** NormalizedVacancy.id (`source:sourceId`) of every vacancy dropped as a cross-provider duplicate — for per-vacancy search diagnostics. */
  readonly duplicateVacancyIds: readonly string[];
  readonly perProvider: readonly ProviderSearchProviderStats[];
}

export interface ProviderSearchOutcome {
  readonly vacancies: readonly Vacancy[];
  readonly stats: ProviderSearchStats;
}

class ProviderSearchTimeoutError extends Error {
  constructor(providerId: string, timeoutMs: number) {
    super(`Provider '${providerId}' search timed out after ${timeoutMs}ms`);
    this.name = 'ProviderSearchTimeoutError';
  }
}

export class ProviderSearchService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly vacancyRepository: VacancyRepository,
    private readonly vacancySourceRepository: VacancySourceRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector,
    private readonly providerTimeoutMs: number = DEFAULT_PROVIDER_TIMEOUT_MS,
    private readonly searchLimit: number = DEFAULT_SEARCH_LIMIT,
    private readonly minRelevanceScore: number = MIN_RELEVANCE_SCORE,
    private readonly diagnostics?: ProviderDiagnosticsService,
    private readonly enableFuzzyDedup: boolean = false,
  ) {}

  /**
   * Searches one provider (when `providerId` is given) or every registered
   * provider in parallel (when it's omitted). Providers are queried with
   * Promise.allSettled behind a per-provider timeout, so one provider being
   * down, erroring, or hanging never blocks results from the rest — failures
   * are logged with the offending providerId and surfaced in `stats.perProvider`.
   * Results are deduplicated across providers before persistence.
   */
  async searchAndPersist(
    profile: SearchProfile,
    providerId?: string,
    workspaceId?: string
  ): Promise<ProviderSearchOutcome> {
    if (!workspaceId) {
      throw new Error('workspaceId is required to search and persist vacancies');
    }

    const startedAt = Date.now();
    const criteria = this.toSearchCriteria(profile);
    const providers = providerId ? [this.registry.get(providerId)] : this.registry.getAll();

    if (providers.length === 0) {
      throw new Error('No providers registered to search');
    }

    const settled = await Promise.allSettled(
      providers.map((provider) => this.searchOneProvider(provider, criteria))
    );

    const perProvider: ProviderSearchProviderStats[] = [];
    const fetchedVacancies: NormalizedVacancy[] = [];

    providers.forEach((provider, index) => {
      const outcome = settled[index];
      if (!outcome) return;
      const currentProviderId = provider.info.id;

      if (outcome.status === 'fulfilled') {
        perProvider.push(outcome.value.stats);
        fetchedVacancies.push(...outcome.value.vacancies);
        return;
      }

      // searchOneProvider never rejects, but guard defensively in case a
      // future change reintroduces an unhandled throw.
      const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      this.logger.error('Provider search crashed unexpectedly', outcome.reason instanceof Error ? outcome.reason : undefined, {
        providerId: currentProviderId,
      });
      perProvider.push({ providerId: currentProviderId, ok: false, fetched: 0, durationMs: 0, error: message });
    });

    const failedProviders = perProvider.filter((p) => !p.ok);
    if (failedProviders.length > 0) {
      this.logger.warn('One or more providers failed during search; continuing with results from the remaining providers', {
        failedProviderIds: failedProviders.map((p) => p.providerId).join(','),
      });
    }

    if (fetchedVacancies.length === 0 && failedProviders.length === providers.length) {
      throw new Error(
        `All providers failed during search: ${failedProviders.map((p) => `${p.providerId} (${p.error ?? 'unknown error'})`).join('; ')}`
      );
    }

    const { unique: deduped, duplicateIds } = this.deduplicate(fetchedVacancies);
    const filtered = filterByRelevance(deduped, profile, this.minRelevanceScore);

    this.logger.info('Relevance filtering applied', {
      beforeFilter: deduped.length,
      afterFilter: filtered.length,
    });

    const fetchDurationMs = Date.now() - startedAt;

    let reused = 0;
    const persisted: Vacancy[] = [];
    const persistedSources: string[] = [];

    const persistStartedAt = Date.now();
    for (const normalized of filtered) {
      const { vacancy, wasReused } = await this.persistVacancy(normalized, workspaceId);
      if (wasReused) reused += 1;
      persisted.push(vacancy);
      persistedSources.push(normalized.source);
    }
    const persistDurationMs = Date.now() - persistStartedAt;

    const durationMs = Date.now() - startedAt;
    this.metrics.recordHistogram('careeros.provider_search.duration_ms', durationMs);
    this.metrics.incrementCounter('careeros.provider_search.vacancies_persisted', persisted.length);
    this.logger.info('Provider search completed', {
      providerIds: providers.map((p) => p.info.id).join(','),
      fetched: fetchedVacancies.length,
      deduplicated: fetchedVacancies.length - deduped.length,
      filtered: filtered.length,
      persisted: persisted.length,
      reused,
      fetchDurationMs,
      persistDurationMs,
      durationMs,
    });

    this.recordProviderDiagnostics(perProvider, deduped, filtered, persistedSources);

    return {
      vacancies: persisted,
      stats: {
        providerIds: providers.map((p) => p.info.id),
        fetched: fetchedVacancies.length,
        persisted: persisted.length,
        reused,
        durationMs,
        fetchDurationMs,
        persistDurationMs,
        deduplicatedCount: deduped.length,
        filteredCount: filtered.length,
        duplicateVacancyIds: duplicateIds,
        perProvider,
      },
    };
  }

  /**
   * Records one ProviderFetchDiagnostics snapshot per provider by grouping
   * each pipeline stage's output by source/providerId — no restructuring of
   * the fetch/dedup/filter/persist pipeline itself, just counting what's
   * already there before it's discarded. `persistedSources` is collected
   * during the persist loop above because the persisted `Vacancy` domain
   * aggregate itself has no `.source` field (provider identity lives on the
   * separate `VacancySource` entity).
   */
  private recordProviderDiagnostics(
    perProvider: readonly ProviderSearchProviderStats[],
    deduped: readonly NormalizedVacancy[],
    filtered: readonly NormalizedVacancy[],
    persistedSources: readonly string[]
  ): void {
    if (!this.diagnostics) return;

    const dedupedCounts = countBySource(deduped, (v) => v.source);
    const filteredCounts = countBySource(filtered, (v) => v.source);
    const persistedCounts = countBySource(persistedSources, (s) => s);

    for (const stats of perProvider) {
      this.diagnostics.recordFetch(stats.providerId, {
        at: new Date(),
        durationMs: stats.durationMs,
        ok: stats.ok,
        error: stats.error,
        fetchedCount: stats.rawFetchedCount ?? stats.fetched,
        normalizedCount: stats.normalizedCount ?? stats.fetched,
        deduplicatedCount: dedupedCounts.get(stats.providerId) ?? 0,
        filteredCount: filteredCounts.get(stats.providerId) ?? 0,
        persistedCount: persistedCounts.get(stats.providerId) ?? 0,
        parseFailureCount: stats.parseFailureCount ?? 0,
      });
    }
  }

  /**
   * Runs a single provider's search behind a timeout and never throws —
   * both thrown errors and timeouts are captured and reported as a failed
   * ProviderSearchProviderStats entry so Promise.allSettled always resolves
   * for every provider and one provider's failure can't take down the batch.
   */
  private async searchOneProvider(
    provider: ProviderJob,
    criteria: SearchCriteria
  ): Promise<{ vacancies: NormalizedVacancy[]; stats: ProviderSearchProviderStats }> {
    const providerId = provider.info.id;
    const startedAt = Date.now();

    try {
      const result = await this.withTimeout(provider.search(criteria), providerId);
      const durationMs = Date.now() - startedAt;

      if (!result.ok) {
        this.logger.error('Provider search failed', undefined, {
          providerId,
          message: result.message,
          errorType: result.error,
        });
        this.metrics.incrementCounter('careeros.provider_search.failed', 1, { providerId });
        return { vacancies: [], stats: { providerId, ok: false, fetched: 0, durationMs, error: result.message } };
      }

      this.metrics.incrementCounter('careeros.provider_search.succeeded', 1, { providerId });
      const parseFailureCount = result.data.normalization.failed.length;
      if (parseFailureCount > 0) {
        this.logger.warn('Provider returned vacancies that failed normalization', {
          providerId,
          parseFailureCount,
          reasons: result.data.normalization.failed.map((f) => `${f.sourceId}: ${f.reason}`).join('; '),
        });
      }
      return {
        vacancies: [...result.data.vacancies],
        stats: {
          providerId,
          ok: true,
          fetched: result.data.vacancies.length,
          durationMs,
          rawFetchedCount: result.data.normalization.stats.total,
          normalizedCount: result.data.normalization.stats.succeeded,
          parseFailureCount,
          parseFailures: result.data.normalization.failed,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const timedOut = error instanceof ProviderSearchTimeoutError;
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(timedOut ? 'Provider search timed out' : 'Provider search threw an unexpected error', error instanceof Error ? error : undefined, {
        providerId,
        timedOut,
      });
      this.metrics.incrementCounter('careeros.provider_search.failed', 1, { providerId });

      return { vacancies: [], stats: { providerId, ok: false, fetched: 0, durationMs, error: message, timedOut } };
    }
  }

  private withTimeout<T>(promise: Promise<T>, providerId: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ProviderSearchTimeoutError(providerId, this.providerTimeoutMs));
      }, this.providerTimeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  private deduplicate(vacancies: readonly NormalizedVacancy[]): { unique: NormalizedVacancy[]; duplicateIds: string[] } {
    if (vacancies.length === 0) return { unique: [], duplicateIds: [] };

    const engine = new DeduplicationEngine({ keyFields: ['contentHash'], similarityThreshold: 0.75, timeWindowMs: 0, enableFuzzyMatching: this.enableFuzzyDedup });
    const result = engine.deduplicate([...vacancies]);

    if (result.stats.duplicatesFound > 0) {
      this.logger.info('Deduplicated vacancies across providers', {
        totalInput: result.stats.totalInput,
        uniqueOutput: result.stats.uniqueOutput,
        duplicatesFound: result.stats.duplicatesFound,
      });
    }

    // Every non-canonical entry in each group is the one dropped as a
    // duplicate — the canonical entry survives into `unique` above.
    const duplicateIds = result.duplicates.flatMap((group) => group.all.slice(1).map((v) => v.id));

    return { unique: result.unique, duplicateIds };
  }

  private toSearchCriteria(profile: SearchProfile): SearchCriteria {
    return {
      positions: [...profile.desiredPositions],
      technologies: profile.desiredTechnologies.map((t) => t.name),
      remoteOnly: profile.isRemoteOnly,
      experienceLevel: {
        min: profile.experienceLevel as ProviderExperienceLevel,
      },
      limit: this.searchLimit,
    };
  }

  private async persistVacancy(
    normalized: NormalizedVacancy,
    workspaceId: string
  ): Promise<{ vacancy: Vacancy; wasReused: boolean }> {
    const source = normalized.source as VacancySource;
    const existingSource = await this.vacancySourceRepository.findByProviderAndExternalId(source, normalized.sourceId);

    if (existingSource) {
      const existing = await this.vacancyRepository.findById(existingSource.vacancyId);
      if (existing) {
        return { vacancy: existing, wasReused: true };
      }
    }

    const company = await this.findOrCreateCompany(normalized.companyName, workspaceId);

    const vacancy = Vacancy.create({
      id: createVacancyId(crypto.randomUUID()),
      title: normalized.title,
      description: normalized.description,
      companyId: company.id,
      location: Location.create({
        city: normalized.location.city,
        country: normalized.location.country,
        workMode: mapWorkMode(normalized.remote.level),
        isRelocationPossible: false,
      }),
      experienceLevel: mapExperienceLevel(normalized.experienceLevel),
      employmentType: normalized.employmentType,
      technologies: normalized.technologies.map((name) => Technology.create(name, 'other')),
      requirements: [],
      salary: normalized.salary?.min !== undefined || normalized.salary?.max !== undefined
        ? Salary.create(
            normalized.salary.min ?? normalized.salary.max ?? 0,
            normalized.salary.max ?? normalized.salary.min ?? 0,
            'USD',
            'monthly'
          )
        : undefined,
    });

    await this.vacancyRepository.save(vacancy, { workspaceId });

    const vacancySource = VacancySourceEntity.create({
      id: createVacancySourceId(crypto.randomUUID()),
      vacancyId: vacancy.id,
      providerType: inferProviderType(source),
      providerId: source,
      externalId: normalized.sourceId,
      sourceUrl: isValidUrl(normalized.url) ? normalized.url : undefined,
      isPrimary: true,
    });

    await this.vacancySourceRepository.save(vacancySource, { workspaceId });

    return { vacancy, wasReused: false };
  }

  private async findOrCreateCompany(name: string, workspaceId: string): Promise<Company> {
    const existing = await this.companyRepository.findByName(name);
    if (existing) {
      return existing;
    }

    const company = Company.create({
      id: createCompanyId(crypto.randomUUID()),
      name,
    });

    await this.companyRepository.save(company, { workspaceId });
    return company;
  }
}

function mapWorkMode(level: RemoteLevel): 'remote' | 'hybrid' | 'onsite' {
  switch (level) {
    case 'remote_only':
      return 'remote';
    case 'hybrid':
      return 'hybrid';
    default:
      return 'onsite';
  }
}

function mapExperienceLevel(level: string | undefined): ExperienceLevel {
  const known: readonly string[] = Object.values(ExperienceLevel);
  if (level && known.includes(level)) {
    return level as ExperienceLevel;
  }
  return ExperienceLevel.MIDDLE;
}

function isValidUrl(value: string): boolean {
  return /^https?:\/\/.+/.test(value.trim());
}

function countBySource<T>(items: readonly T[], getSource: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const source = getSource(item);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return counts;
}

function filterByRelevance(
  vacancies: readonly NormalizedVacancy[],
  profile: SearchProfile,
  minRelevanceScore: number
): NormalizedVacancy[] {
  const desiredPositions = profile.desiredPositions.map((p) => p.toLowerCase());
  const desiredTechs = new Set(profile.desiredTechnologies.map((t) => t.name.toLowerCase()));

  const positionKeywords = extractPositionKeywords(desiredPositions);

  return vacancies.filter((vacancy) => {
    const score = calculateVacancyRelevance(vacancy, positionKeywords, desiredTechs);
    return score >= minRelevanceScore;
  });
}

function extractPositionKeywords(positions: readonly string[]): string[] {
  const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  const keywords: string[] = [];

  for (const position of positions) {
    const words = position.split(/\s+/);
    for (const word of words) {
      const lower = word.toLowerCase();
      if (!stopWords.has(lower) && lower.length > 1) {
        keywords.push(lower);
      }
    }
  }

  return [...new Set(keywords)];
}

function calculateVacancyRelevance(
  vacancy: NormalizedVacancy,
  positionKeywords: string[],
  desiredTechs: Set<string>
): number {
  let score = 0;

  const titleLower = vacancy.title.toLowerCase();
  for (const keyword of positionKeywords) {
    if (titleLower.includes(keyword)) {
      score += 3;
    }
  }

  const descLower = vacancy.description.toLowerCase();
  for (const keyword of positionKeywords) {
    if (descLower.includes(keyword)) {
      score += 1;
    }
  }

  for (const tech of vacancy.technologies) {
    const techLower = tech.toLowerCase();
    if (desiredTechs.has(techLower)) {
      score += 2;
    }
  }

  return score;
}

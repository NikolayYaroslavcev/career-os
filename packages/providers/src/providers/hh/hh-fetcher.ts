import type { Fetcher, FetchResult } from '../../interfaces/fetcher.js';
import type { ProviderResult, ResultMeta } from '../../interfaces/result.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import type { SearchCriteria } from '../../interfaces/search-criteria.js';
import type { SyncCursor, CursorState } from '../../interfaces/sync-cursor.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { PROVIDER_METRICS } from '../../observability/metrics.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import type {
  HHVacancyListItem,
  HHVacancyDetail,
  HHVacancyListResponse,
  HHSearchParams,
  HHArea,
  HHSalary,
  HHNamedEntity,
  HHSnippet,
} from './hh-types.js';

export interface HHFetcherConfig {
  readonly baseUrl: string;
  readonly accessToken?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

const TECH_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust',
  'react', 'vue', 'angular', 'node', 'express', 'django', 'flask', 'spring',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible',
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  'git', 'ci/cd', 'jenkins', 'github actions', 'gitlab',
  'html', 'css', 'scss', 'less', 'tailwind',
  'sql', 'nosql', 'graphql', 'rest', 'grpc',
  'linux', 'bash', 'powershell',
  'machine learning', 'ml', 'ai', 'data science',
  'flutter', 'swift', 'kotlin', 'android', 'ios',
  'php', 'ruby', 'scala', 'dart',
  'nextjs', 'nuxtjs', 'svelte', 'remix',
  'webpack', 'vite', 'esbuild',
  'jest', 'mocha', 'pytest', 'junit',
  'figma', 'sketch', 'adobe xd',
];

export class HHFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly accessToken?: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: HHFetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.accessToken = config.accessToken;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('hh.fetcher.search', {
      providerId: 'hh',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching HH jobs', {
        providerId: 'hh',
        operation: 'search',
        query: criteria.query,
        technologies: criteria.technologies,
      });

      const allJobs: RawJob[] = [];
      const seenIds = new Set<string>();
      let page = 0;
      const perPage = 100;
      let hasMore = true;

      while (hasMore) {
        const params = this.buildSearchParams(criteria, page, perPage);
        const url = this.buildSearchUrl(params);

        const response = await fetch(url, { headers: this.buildHeaders() });

        if (!response.ok) {
          span.setAttribute('error', true);
          span.setAttribute('http.status', response.status);

          if (response.status === 429) {
            return {
              ok: false,
              error: ProviderErrorType.RATE_LIMITED,
              message: `HTTP ${response.status}: Rate limited by HH API`,
              retryable: true,
              meta: { durationMs: Date.now() - startTime },
            };
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as HHVacancyListResponse;
        const jobs = this.parseResponse(data);

        for (const job of jobs) {
          if (!seenIds.has(job.sourceId)) {
            seenIds.add(job.sourceId);
            allJobs.push(job);
          }
        }

        page++;
        hasMore = page < data.pages;
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'hh',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, {
        providerId: 'hh',
      });

      span.setAttribute('jobs.fetched', allJobs.length);
      span.setAttribute('duration_ms', durationMs);
      span.end();

      const meta: ResultMeta = {
        durationMs,
        providerMeta: { totalJobs: allJobs.length },
      };

      return { ok: true, data: allJobs, meta };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'hh',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'hh',
      });

      span.setAttribute('error', true);
      span.end();

      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.startsWith('HTTP')) {
        return {
          ok: false,
          error: ProviderErrorType.NETWORK_ERROR,
          message,
          retryable: true,
          meta: { durationMs },
        };
      }

      if (message.includes('JSON')) {
        return {
          ok: false,
          error: ProviderErrorType.INVALID_RESPONSE,
          message,
          retryable: false,
          meta: { durationMs },
        };
      }

      return {
        ok: false,
        error: ProviderErrorType.UNKNOWN_ERROR,
        message,
        retryable: false,
        meta: { durationMs },
      };
    }
  }

  /**
   * The one place HH's detail endpoint is called — a single vacancy, on demand.
   * Bulk `search()` never calls this per-item; it relies entirely on the
   * list endpoint's `snippet` for description text.
   */
  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const span = this.tracer.startSpan('hh.fetcher.getVacancy', {
      providerId: 'hh',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching HH vacancy', {
        providerId: 'hh',
        operation: 'getVacancy',
        sourceId,
      });

      const url = `${this.baseUrl}/vacancies/${sourceId}`;
      const response = await fetch(url, { headers: this.buildHeaders() });

      if (!response.ok) {
        if (response.status === 404) {
          span.setAttribute('found', false);
          span.end();
          return { ok: true, data: null, meta: { durationMs: Date.now() - startTime } };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as HHVacancyDetail;
      const rawJob = this.parseDetailVacancy(data);
      const durationMs = Date.now() - startTime;

      span.setAttribute('found', !!rawJob);
      span.end();

      return { ok: true, data: rawJob ?? null, meta: { durationMs } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      span.setAttribute('error', true);
      span.end();

      return {
        ok: false,
        error: ProviderErrorType.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        meta: { durationMs },
      };
    }
  }

  async fetchWithCursor(
    criteria: SearchCriteria,
    cursor: SyncCursor,
  ): Promise<ProviderResult<FetchResult>> {
    const span = this.tracer.startSpan('hh.fetcher.fetchWithCursor', {
      providerId: 'hh',
    });

    const startTime = Date.now();

    try {
      let page = 0;
      if (cursor.type === 'page') {
        page = cursor.page;
      }

      const perPage = 100;
      const params = this.buildSearchParams(criteria, page, perPage);
      const url = this.buildSearchUrl(params);

      const response = await fetch(url, { headers: this.buildHeaders() });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as HHVacancyListResponse;
      const jobs = this.parseResponse(data);
      const durationMs = Date.now() - startTime;

      const cursorState: CursorState = {
        cursor: {
          type: 'page',
          page: page + 1,
          perPage,
          totalPages: data.pages,
          totalResults: data.found,
        },
        strategy: 'page',
        exhausted: page + 1 >= data.pages,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore: page + 1 < data.pages,
        meta: { totalJobs: data.found, pages: data.pages },
      };

      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return {
        ok: true,
        data: fetchResult,
        meta: { durationMs },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      span.setAttribute('error', true);
      span.end();

      return {
        ok: false,
        error: ProviderErrorType.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        meta: { durationMs },
      };
    }
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const span = this.tracer.startSpan('hh.fetcher.ping', {
      providerId: 'hh',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging HH API', {
        providerId: 'hh',
        operation: 'ping',
      });

      const response = await fetch(`${this.baseUrl}/vacancies?per_page=1`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      const durationMs = Date.now() - startTime;

      span.setAttribute('http.status', response.status);
      span.end();

      return { ok: true, data: response.ok, meta: { durationMs } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      span.setAttribute('error', true);
      span.end();

      return {
        ok: false,
        error: ProviderErrorType.NETWORK_ERROR,
        message: error instanceof Error ? error.message : 'Network error',
        retryable: true,
        meta: { durationMs },
      };
    }
  }

  private buildHeaders(): Record<string, string> {
    // HH's edge (DDoS-Guard) blacklists generic "AppName/x.y"-style User-Agent
    // strings outright (confirmed via a live 403 with
    // {"errors":[{"type":"bad_user_agent","value":"blacklisted"}]} using the
    // previous 'CareerOS/1.0' value) — a URL-bearing, bot-descriptor-style
    // value clears that specific check.
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  private buildSearchParams(
    criteria: SearchCriteria,
    page: number,
    perPage: number,
  ): HHSearchParams {
    const params: HHSearchParams = {};

    if (criteria.query) {
      params.text = criteria.query;
    }

    if (criteria.technologies && criteria.technologies.length > 0) {
      params.text = criteria.technologies.join(' OR ');
    }

    if (criteria.location) {
      params.area = criteria.location;
    }

    if (criteria.remoteOnly) {
      params.schedule = 'remote';
    }

    if (criteria.experienceLevel) {
      const experienceMap: Record<string, string> = {
        'intern': 'noExperience',
        'junior': 'between1And3',
        'middle': 'between3And6',
        'senior': 'moreThan6',
      };

      if (criteria.experienceLevel.min) {
        params.experience = experienceMap[criteria.experienceLevel.min] ?? '';
      }
    }

    if (criteria.salary) {
      if (criteria.salary.min) {
        params.salary = criteria.salary.min;
        params.only_with_salary = true;
      }
    }

    params.page = page;
    params.per_page = perPage;

    return params;
  }

  private buildSearchUrl(params: HHSearchParams): string {
    const url = new URL(`${this.baseUrl}/vacancies`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  private parseResponse(data: HHVacancyListResponse): RawJob[] {
    const jobs: RawJob[] = [];
    const now = new Date();

    for (const item of data.items) {
      const rawJob = this.parseListVacancy(item, now);
      if (rawJob) {
        jobs.push(rawJob);
      }
    }

    return jobs;
  }

  /**
   * List-endpoint parse path. There is no `description` field here — only the
   * truncated `snippet.requirement`/`snippet.responsibility` — and no
   * `key_skills`, so technologies are keyword-extracted from title + snippet.
   */
  private parseListVacancy(vacancy: HHVacancyListItem, now = new Date()): RawJob | null {
    if (!this.isValidVacancy(vacancy)) {
      return null;
    }

    const description = this.buildDescriptionFromSnippet(vacancy.snippet);

    return {
      sourceId: vacancy.id,
      title: vacancy.name,
      description,
      companyName: vacancy.employer.name,
      companySourceId: vacancy.employer.id,
      location: this.formatLocation(vacancy.area),
      salary: this.parseSalary(vacancy.salary),
      technologies: this.extractTechnologiesFromText(vacancy.name, description),
      url: vacancy.alternate_url,
      publishedAt: new Date(vacancy.published_at),
      fetchedAt: now,
      remote: this.isRemote(vacancy.schedule),
      employmentType: this.mapEmploymentType(vacancy.employment),
      extensions: {
        employerId: vacancy.employer.id,
        employerLogo: vacancy.employer.logo_urls?.original,
        experience: vacancy.experience?.name,
        schedule: vacancy.schedule?.name,
        address: vacancy.address,
        professionalRoles: vacancy.professional_roles?.map((role) => role.name),
      },
    };
  }

  /**
   * Detail-endpoint parse path (`getVacancy`). Uses the real `description` and
   * `key_skills`, which are only ever present here — never on a list response.
   */
  private parseDetailVacancy(vacancy: HHVacancyDetail): RawJob | null {
    if (!this.isValidVacancy(vacancy)) {
      return null;
    }

    const description = vacancy.description || this.buildDescriptionFromSnippet(vacancy.snippet);
    const keySkills = (vacancy.key_skills ?? []).map((skill) => skill.name.toLowerCase().trim());
    const inferred = this.extractTechnologiesFromText(vacancy.name, description);
    const technologies = [...new Set([...keySkills, ...inferred])];

    return {
      sourceId: vacancy.id,
      title: vacancy.name,
      description,
      companyName: vacancy.employer.name,
      companySourceId: vacancy.employer.id,
      location: this.formatLocation(vacancy.area),
      salary: this.parseSalary(vacancy.salary),
      technologies,
      url: vacancy.alternate_url,
      publishedAt: new Date(vacancy.published_at),
      fetchedAt: new Date(),
      remote: this.isRemote(vacancy.schedule),
      employmentType: this.mapEmploymentType(vacancy.employment),
      extensions: {
        employerId: vacancy.employer.id,
        employerLogo: vacancy.employer.logo_urls?.original,
        experience: vacancy.experience?.name,
        schedule: vacancy.schedule?.name,
        address: vacancy.address,
        professionalRoles: vacancy.professional_roles?.map((role) => role.name),
      },
    };
  }

  private isValidVacancy(vacancy: HHVacancyListItem): boolean {
    return (
      typeof vacancy === 'object' &&
      vacancy !== null &&
      'id' in vacancy &&
      'name' in vacancy &&
      'employer' in vacancy &&
      'area' in vacancy
    );
  }

  /**
   * The list endpoint's `snippet` fields are truncated HTML fragments (often
   * containing `<highlighttext>` marks around matched search terms). No tag
   * stripping happens here — HHMapper.normalizeDescription already strips any
   * HTML tag on the way to a MappedJob, so raw markup is safe to pass through.
   */
  private buildDescriptionFromSnippet(snippet: HHSnippet | null): string {
    if (!snippet) {
      return '';
    }

    const parts = [snippet.responsibility, snippet.requirement].filter(
      (part): part is string => Boolean(part && part.trim().length > 0),
    );

    return parts.join('\n\n');
  }

  private formatLocation(area: HHArea): string {
    return area?.name || 'Не указано';
  }

  private parseSalary(salary: HHSalary | null): RawJob['salary'] | undefined {
    if (!salary) {
      return undefined;
    }

    const from = salary.from ?? undefined;
    const to = salary.to ?? undefined;

    if (!from && !to) {
      return undefined;
    }

    return {
      from,
      to,
      currency: salary.currency,
      period: 'monthly',
    };
  }

  private extractTechnologiesFromText(title: string, description: string): string[] {
    const combined = `${title} ${description}`.toLowerCase();
    const skills: string[] = [];

    for (const tech of TECH_KEYWORDS) {
      if (combined.includes(tech)) {
        skills.push(tech);
      }
    }

    return [...new Set(skills)];
  }

  /**
   * HH's remote schedule name is "Удаленная работа" (no ё) — matching on the
   * literal string 'удалённ' (with ё) never matches it. Prefer the stable
   * `schedule.id === 'remote'` and fall back to a ё-agnostic name check.
   */
  private isRemote(schedule: HHNamedEntity): boolean {
    if (schedule?.id === 'remote') {
      return true;
    }
    const scheduleName = schedule?.name?.toLowerCase() ?? '';
    return scheduleName.includes('удален') || scheduleName.includes('удалён') || scheduleName.includes('remote');
  }

  private mapEmploymentType(employment: HHNamedEntity): string | undefined {
    const name = employment?.name?.toLowerCase() ?? '';

    if (name.includes('полная')) return 'full_time';
    if (name.includes('частичная')) return 'part_time';
    if (name.includes('проект')) return 'contract';
    if (name.includes('стажировка')) return 'internship';
    if (name.includes('волонтёрство')) return 'volunteer';

    return undefined;
  }
}

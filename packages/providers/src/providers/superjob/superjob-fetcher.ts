import { fetchWithTimeout } from '../../resilience/resilient-fetch.js';
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
import type { SJVacancy, SJVacancyListResponse, SJSearchParams, SJErrorResponse, SJNamedEntity } from './superjob-types.js';

export interface SJFetcherConfig {
  readonly baseUrl: string;
  // X-Api-App-Id — SuperJob rejects every endpoint (including plain search)
  // without it; see superjob-provider.ts for where this is required.
  readonly apiKey: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

// api.superjob.ru hard-caps `count` at 100 — confirmed by SuperJob's own
// client examples ("api запрещает запрашивать больше 100 вакансий").
const MAX_PAGE_SIZE = 100;

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
  '1c', '1с',
];

export class SJFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: SJFetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('superjob.fetcher.search', {
      providerId: 'superjob',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching SuperJob vacancies', {
        providerId: 'superjob',
        operation: 'search',
        query: criteria.query,
        technologies: criteria.technologies,
      });

      const allJobs: RawJob[] = [];
      const seenIds = new Set<string>();
      let page = 0;
      let hasMore = true;
      let total = 0;

      while (hasMore) {
        const params = this.buildSearchParams(criteria, page, MAX_PAGE_SIZE);
        const url = this.buildSearchUrl(params);

        const response = await fetchWithTimeout(url, { headers: this.buildHeaders() });
        const errorResult = await this.checkForApiError(response, startTime);
        if (errorResult) {
          span.setAttribute('error', true);
          span.end();
          return errorResult;
        }

        const data = (await response.json()) as SJVacancyListResponse;
        total = data.total;
        const jobs = this.parseResponse(data);

        for (const job of jobs) {
          if (!seenIds.has(job.sourceId)) {
            seenIds.add(job.sourceId);
            allJobs.push(job);
          }
        }

        page++;
        hasMore = jobs.length > 0 && page * MAX_PAGE_SIZE < total;
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'superjob',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, {
        providerId: 'superjob',
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
        providerId: 'superjob',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'superjob',
      });

      span.setAttribute('error', true);
      span.end();

      const message = error instanceof Error ? error.message : 'Unknown error';

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
   * `GET /vacancies/{id}/` returns a single vacancy object with the same
   * shape as a search-result item (unlike HH, SuperJob's list endpoint
   * already carries the full description — there's no separate
   * snippet-vs-detail split to bridge here).
   */
  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const span = this.tracer.startSpan('superjob.fetcher.getVacancy', {
      providerId: 'superjob',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching SuperJob vacancy', {
        providerId: 'superjob',
        operation: 'getVacancy',
        sourceId,
      });

      const url = `${this.baseUrl}/vacancies/${sourceId}/`;
      const response = await fetchWithTimeout(url, { headers: this.buildHeaders() });

      if (response.status === 404) {
        span.setAttribute('found', false);
        span.end();
        return { ok: true, data: null, meta: { durationMs: Date.now() - startTime } };
      }

      const errorResult = await this.checkForApiError(response, startTime);
      if (errorResult) {
        span.setAttribute('error', true);
        span.end();
        return errorResult;
      }

      const data = (await response.json()) as SJVacancy;
      const rawJob = this.parseVacancy(data);
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
    const span = this.tracer.startSpan('superjob.fetcher.fetchWithCursor', {
      providerId: 'superjob',
    });

    const startTime = Date.now();

    try {
      let page = 0;
      if (cursor.type === 'page') {
        page = cursor.page;
      }

      const params = this.buildSearchParams(criteria, page, MAX_PAGE_SIZE);
      const url = this.buildSearchUrl(params);

      const response = await fetchWithTimeout(url, { headers: this.buildHeaders() });
      const errorResult = await this.checkForApiError(response, startTime);
      if (errorResult) {
        span.setAttribute('error', true);
        span.end();
        return errorResult;
      }

      const data = (await response.json()) as SJVacancyListResponse;
      const jobs = this.parseResponse(data);
      const durationMs = Date.now() - startTime;

      const totalPages = Math.ceil(data.total / MAX_PAGE_SIZE);
      const nextPageHasMore = jobs.length > 0 && (page + 1) * MAX_PAGE_SIZE < data.total;

      const cursorState: CursorState = {
        cursor: {
          type: 'page',
          page: page + 1,
          perPage: MAX_PAGE_SIZE,
          totalPages,
          totalResults: data.total,
        },
        strategy: 'page',
        exhausted: !nextPageHasMore,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore: nextPageHasMore,
        meta: { totalJobs: data.total, pages: totalPages },
      };

      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: fetchResult, meta: { durationMs } };
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
    const span = this.tracer.startSpan('superjob.fetcher.ping', { providerId: 'superjob' });
    const startTime = Date.now();

    try {
      this.logger.debug('Pinging SuperJob API', { providerId: 'superjob', operation: 'ping' });

      const response = await fetchWithTimeout(`${this.baseUrl}/vacancies/?count=1`, {
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
    return {
      'Accept': 'application/json',
      'X-Api-App-Id': this.apiKey,
    };
  }

  /**
   * SuperJob signals every failure — missing/invalid key, rate limiting,
   * bad params — as HTTP 200/403/etc with a JSON `{ error: { code, message } }`
   * body rather than always matching the HTTP status to the failure kind, so
   * the error body's `code` (not just the transport status) decides the
   * ProviderErrorType. Returns null when the response is a real success.
   */
  private async checkForApiError(
    response: Response,
    startTime: number,
  ): Promise<ProviderResult<never> | null> {
    if (response.ok) {
      return null;
    }

    const durationMs = Date.now() - startTime;

    if (response.status === 429) {
      return {
        ok: false,
        error: ProviderErrorType.RATE_LIMITED,
        message: 'HTTP 429: Rate limited by SuperJob API',
        retryable: true,
        meta: { durationMs },
      };
    }

    let body: SJErrorResponse | undefined;
    try {
      body = (await response.json()) as SJErrorResponse;
    } catch {
      // Non-JSON body (e.g. a WAF/edge HTML page) — fall through to the generic case below.
    }

    if (response.status === 403) {
      return {
        ok: false,
        error: ProviderErrorType.AUTHENTICATION_ERROR,
        message: body?.error?.message
          ? `SuperJob API rejected the request: ${body.error.message}`
          : 'HTTP 403: SuperJob API rejected the request (invalid or missing X-Api-App-Id)',
        retryable: false,
        meta: { durationMs },
      };
    }

    return {
      ok: false,
      error: ProviderErrorType.NETWORK_ERROR,
      message: body?.error?.message ?? `HTTP ${response.status}: ${response.statusText}`,
      retryable: true,
      meta: { durationMs },
    };
  }

  private buildSearchParams(
    criteria: SearchCriteria,
    page: number,
    count: number,
  ): SJSearchParams {
    const params: SJSearchParams = {};

    if (criteria.technologies && criteria.technologies.length > 0) {
      params.keyword = criteria.technologies.join(' ');
    } else if (criteria.query) {
      params.keyword = criteria.query;
    }

    if (criteria.salary?.min) {
      params.payment_from = criteria.salary.min;
    }
    if (criteria.salary?.max) {
      params.payment_to = criteria.salary.max;
    }

    params.page = page;
    params.count = count;

    return params;
  }

  private buildSearchUrl(params: SJSearchParams): string {
    const url = new URL(`${this.baseUrl}/vacancies/`);

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  private parseResponse(data: SJVacancyListResponse): RawJob[] {
    const jobs: RawJob[] = [];
    const now = new Date();

    for (const item of data.objects) {
      const rawJob = this.parseVacancy(item, now);
      if (rawJob) {
        jobs.push(rawJob);
      }
    }

    return jobs;
  }

  private parseVacancy(vacancy: SJVacancy, now = new Date()): RawJob | null {
    if (!this.isValidVacancy(vacancy)) {
      return null;
    }

    const description = this.buildDescription(vacancy);
    const companyName = vacancy.client?.title || vacancy.firm_name || 'Не указано';

    return {
      sourceId: String(vacancy.id),
      title: vacancy.profession,
      description,
      companyName,
      companySourceId: vacancy.id_client != null ? String(vacancy.id_client) : undefined,
      location: vacancy.town?.title || 'Не указано',
      salary: this.parseSalary(vacancy),
      technologies: this.extractTechnologiesFromText(vacancy.profession, description),
      url: vacancy.link,
      publishedAt: new Date(vacancy.date_published * 1000),
      fetchedAt: now,
      remote: this.isRemote(vacancy),
      employmentType: this.mapEmploymentType(vacancy.type_of_work),
      extensions: {
        clientId: vacancy.id_client ?? undefined,
        clientLogo: vacancy.client?.logo ?? undefined,
        experience: vacancy.experience?.title,
        placeOfWork: vacancy.place_of_work?.title,
        agreement: vacancy.agreement,
      },
    };
  }

  private isValidVacancy(vacancy: SJVacancy): boolean {
    return (
      typeof vacancy === 'object' &&
      vacancy !== null &&
      typeof vacancy.id === 'number' &&
      typeof vacancy.profession === 'string' &&
      vacancy.profession.trim().length > 0
    );
  }

  /**
   * `vacancyRichText` (HTML) is the fullest field when present; `work`
   * (responsibilities) + `candidat` (requirements) are the plain-text
   * fallback every vacancy has. HHMapper-equivalent tag stripping happens in
   * SJMapper.normalizeDescription, so raw HTML here is safe to pass through.
   */
  private buildDescription(vacancy: SJVacancy): string {
    if (vacancy.vacancyRichText && vacancy.vacancyRichText.trim().length > 0) {
      return vacancy.vacancyRichText;
    }

    const parts = [vacancy.work, vacancy.candidat].filter(
      (part): part is string => Boolean(part && part.trim().length > 0),
    );

    return parts.join('\n\n');
  }

  private parseSalary(vacancy: SJVacancy): RawJob['salary'] | undefined {
    const from = vacancy.payment_from > 0 ? vacancy.payment_from : undefined;
    const to = vacancy.payment_to > 0 ? vacancy.payment_to : undefined;

    if (!from && !to) {
      return undefined;
    }

    return {
      from,
      to,
      currency: (vacancy.currency || 'rub').toUpperCase(),
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
   * SuperJob has no dedicated boolean "remote" field on a vacancy — unlike HH's
   * `schedule.id === 'remote'`, remoteness has to be inferred from
   * `place_of_work`/`type_of_work` names or free text.
   */
  private isRemote(vacancy: SJVacancy): boolean {
    const haystack = [
      vacancy.place_of_work?.title,
      vacancy.type_of_work?.title,
      vacancy.profession,
    ]
      .filter((v): v is string => Boolean(v))
      .join(' ')
      .toLowerCase();

    return haystack.includes('удален') || haystack.includes('удалён') || haystack.includes('remote');
  }

  private mapEmploymentType(typeOfWork?: SJNamedEntity | null): string | undefined {
    const name = typeOfWork?.title?.toLowerCase() ?? '';

    if (name.includes('полная')) return 'full_time';
    if (name.includes('частичная')) return 'part_time';
    if (name.includes('проект')) return 'contract';
    if (name.includes('стажировка')) return 'internship';
    if (name.includes('вахт')) return 'contract';

    return undefined;
  }
}

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
import type { AdzunaJob, AdzunaJobResult } from './adzuna-types.js';

export interface AdzunaFetcherConfig {
  readonly appId: string;
  readonly appKey: string;
  readonly country: string;
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class AdzunaFetcher implements Fetcher {
  private readonly appId: string;
  private readonly appKey: string;
  private readonly country: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: AdzunaFetcherConfig) {
    this.appId = config.appId;
    this.appKey = config.appKey;
    this.country = config.country;
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('adzuna.fetcher.search', {
      providerId: 'adzuna',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Adzuna jobs', {
        providerId: 'adzuna',
        operation: 'search',
        query: criteria.query,
      });

      const allJobs: RawJob[] = [];
      let page = 1;
      const perPage = 50;
      const maxPages = 10; // Adzuna caps at 500 results (10 pages * 50)

      while (page <= maxPages) {
        const url = this.buildSearchUrl(criteria, page, perPage);
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
          if (response.status === 429) {
            span.setAttribute('error', true);
            span.setAttribute('http.status', 429);
            throw new Error(`HTTP 429: Rate limited`);
          }
          span.setAttribute('error', true);
          span.setAttribute('http.status', response.status);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: AdzunaJobResult = await response.json() as AdzunaJobResult;
        const jobs = this.parseResponse(data);

        if (jobs.length === 0) break;

        allJobs.push(...jobs);
        page++;

        // Respect rate limits — 25 req/min
        if (page <= maxPages) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'adzuna',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, {
        providerId: 'adzuna',
      });

      span.setAttribute('jobs.fetched', allJobs.length);
      span.setAttribute('duration_ms', durationMs);
      span.end();

      const meta: ResultMeta = {
        durationMs,
        providerMeta: { totalJobs: allJobs.length, pages: page - 1 },
      };

      return { ok: true, data: allJobs, meta };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'adzuna',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'adzuna',
      });

      span.setAttribute('error', true);
      span.end();

      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('429') || message.includes('Rate limited')) {
        return {
          ok: false,
          error: ProviderErrorType.RATE_LIMITED,
          message,
          retryable: true,
          meta: { durationMs },
        };
      }

      if (message.startsWith('HTTP')) {
        return {
          ok: false,
          error: ProviderErrorType.NETWORK_ERROR,
          message,
          retryable: true,
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

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const span = this.tracer.startSpan('adzuna.fetcher.getVacancy', {
      providerId: 'adzuna',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Adzuna vacancy', {
        providerId: 'adzuna',
        operation: 'getVacancy',
        sourceId,
      });

      const result = await this.search({});
      if (!result.ok) {
        span.end();
        return result;
      }

      const job = result.data.find((j) => j.sourceId === sourceId);
      const durationMs = Date.now() - startTime;

      span.setAttribute('found', !!job);
      span.end();

      return { ok: true, data: job ?? null, meta: { durationMs } };
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
    const span = this.tracer.startSpan('adzuna.fetcher.fetchWithCursor', {
      providerId: 'adzuna',
    });

    const startTime = Date.now();

    try {
      let page = 1;
      let perPage = 50;

      if (cursor.type === 'page') {
        page = cursor.page;
        perPage = cursor.perPage;
      }

      const url = this.buildSearchUrl(criteria, page, perPage);
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: AdzunaJobResult = await response.json() as AdzunaJobResult;
      const jobs = this.parseResponse(data);
      const durationMs = Date.now() - startTime;

      const totalPages = Math.ceil((data.count ?? 0) / perPage);
      const hasMore = page < totalPages;

      const cursorState: CursorState = {
        cursor: {
          type: 'page',
          page,
          perPage,
          totalPages,
        },
        strategy: 'page',
        exhausted: !hasMore,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore,
        meta: { totalResults: data.count ?? 0, page, totalPages },
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
    const span = this.tracer.startSpan('adzuna.fetcher.ping', {
      providerId: 'adzuna',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging Adzuna API', {
        providerId: 'adzuna',
        operation: 'ping',
      });

      const url = `${this.baseUrl}/jobs/${this.country}/search/1?app_id=${this.appId}&app_key=${this.appKey}&results_per_page=1`;
      const response = await fetchWithTimeout(url, { method: 'GET' });
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

  private buildSearchUrl(criteria: SearchCriteria, page: number, perPage: number): string {
    const url = new URL(`${this.baseUrl}/jobs/${this.country}/search/${page}`);

    url.searchParams.set('app_id', this.appId);
    url.searchParams.set('app_key', this.appKey);
    url.searchParams.set('results_per_page', String(perPage));
    url.searchParams.set('content-type', 'application/json');

    if (criteria.query) {
      url.searchParams.set('what', criteria.query);
    }

    if (criteria.location) {
      url.searchParams.set('where', criteria.location);
    }

    if (criteria.salary?.min) {
      url.searchParams.set('salary_min', String(criteria.salary.min));
    }

    if (criteria.salary?.max) {
      url.searchParams.set('salary_max', String(criteria.salary.max));
    }

    return url.toString();
  }

  private parseResponse(data: AdzunaJobResult): RawJob[] {
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    const jobs: RawJob[] = [];
    const now = new Date();

    for (const item of data.results) {
      if (!this.isValidJob(item)) {
        continue;
      }

      const rawJob: RawJob = {
        sourceId: item.id,
        title: item.title,
        description: item.description,
        companyName: item.company.display_name,
        location: item.location.display_name,
        salary: this.parseSalary(item),
        technologies: [],
        url: item.redirect_url,
        publishedAt: new Date(item.created),
        fetchedAt: now,
        extensions: {
          category: item.category?.tag,
          categoryLabel: item.category?.label,
          contractType: item.contract_type,
          contractTime: item.contract_time,
          latitude: item.latitude,
          longitude: item.longitude,
          area: item.location.area,
          salaryIsPredicted: item.salary_is_predicted,
        },
      };

      jobs.push(rawJob);
    }

    return jobs;
  }

  private isValidJob(item: AdzunaJob): boolean {
    return (
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.company === 'object' &&
      item.company !== null &&
      typeof item.company.display_name === 'string'
    );
  }

  private parseSalary(job: AdzunaJob): RawJob['salary'] | undefined {
    const min = job.salary_min;
    const max = job.salary_max;

    if (min === null && max === null) {
      return undefined;
    }

    return {
      from: min ?? undefined,
      to: max ?? undefined,
      currency: 'GBP',
      period: 'yearly',
    };
  }
}

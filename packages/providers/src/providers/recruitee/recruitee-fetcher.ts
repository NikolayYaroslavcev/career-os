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
import type { RecruiteeResponse } from './recruitee-types.js';

export interface RecruiteeFetcherConfig {
  readonly company: string;
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class RecruiteeFetcher implements Fetcher {
  private readonly company: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: RecruiteeFetcherConfig) {
    this.company = config.company;
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('recruitee.fetcher.search', {
      providerId: 'recruitee',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Recruitee jobs', {
        providerId: 'recruitee',
        operation: 'search',
        query: criteria.query,
      });

      const allJobs: RawJob[] = [];
      let page = 1;
      const perPage = 50;
      const maxPages = 10;

      while (page <= maxPages) {
        const url = this.buildSearchUrl(criteria, page, perPage);
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
          span.setAttribute('error', true);
          span.setAttribute('http.status', response.status);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: RecruiteeResponse = await response.json() as RecruiteeResponse;
        const jobs = this.parseResponse(data);

        if (jobs.length === 0) break;

        allJobs.push(...jobs);
        page++;

        if (page > data.meta.total_pages) break;
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'recruitee',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, {
        providerId: 'recruitee',
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
        providerId: 'recruitee',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'recruitee',
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
    const span = this.tracer.startSpan('recruitee.fetcher.getVacancy', {
      providerId: 'recruitee',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Recruitee vacancy', {
        providerId: 'recruitee',
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
    const span = this.tracer.startSpan('recruitee.fetcher.fetchWithCursor', {
      providerId: 'recruitee',
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

      const data: RecruiteeResponse = await response.json() as RecruiteeResponse;
      const jobs = this.parseResponse(data);
      const durationMs = Date.now() - startTime;

      const hasMore = page < data.meta.total_pages;

      const cursorState: CursorState = {
        cursor: {
          type: 'page',
          page: page + 1,
          perPage,
          totalPages: data.meta.total_pages,
        },
        strategy: 'page',
        exhausted: !hasMore,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore,
        meta: { totalResults: data.meta.total, page, totalPages: data.meta.total_pages },
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
    const span = this.tracer.startSpan('recruitee.fetcher.ping', {
      providerId: 'recruitee',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging Recruitee API', {
        providerId: 'recruitee',
        operation: 'ping',
      });

      const url = `${this.baseUrl}/companies/${this.company}/offers?page=1&per_page=1`;
      const response = await fetchWithTimeout(url);
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
    const url = new URL(`${this.baseUrl}/companies/${this.company}/offers`);

    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));

    if (criteria.query) {
      url.searchParams.set('q', criteria.query);
    }

    if (criteria.remoteOnly) {
      url.searchParams.set('remote', 'true');
    }

    return url.toString();
  }

  private parseResponse(data: RecruiteeResponse): RawJob[] {
    if (!data.offers || !Array.isArray(data.offers)) {
      return [];
    }

    const jobs: RawJob[] = [];
    const now = new Date();

    for (const offer of data.offers) {
      if (!this.isValidOffer(offer)) {
        continue;
      }

      const rawJob: RawJob = {
        sourceId: String(offer.id),
        title: offer.title,
        description: offer.description,
        companyName: 'Unknown',
        location: offer.location || 'Unknown',
        salary: this.parseSalary(offer),
        technologies: [],
        url: offer.apply_url,
        publishedAt: new Date(offer.created_at),
        fetchedAt: now,
        remote: offer.remote,
        extensions: {
          employmentType: offer.employment_type,
          department: offer.department,
          team: offer.team,
          createdAt: offer.created_at,
          updatedAt: offer.updated_at,
        },
      };

      jobs.push(rawJob);
    }

    return jobs;
  }

  private isValidOffer(offer: Record<string, unknown>): boolean {
    return (
      typeof offer === 'object' &&
      offer !== null &&
      typeof offer['id'] === 'number' &&
      typeof offer['title'] === 'string'
    );
  }

  private parseSalary(offer: { salary_from?: number | null; salary_to?: number | null }): RawJob['salary'] | undefined {
    if (!offer.salary_from && !offer.salary_to) return undefined;

    return {
      from: offer.salary_from ?? undefined,
      to: offer.salary_to ?? undefined,
      currency: 'EUR',
      period: 'yearly',
    };
  }
}

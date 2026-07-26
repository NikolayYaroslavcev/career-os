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
import type { SmartRecruitersResponse } from './smartrecruiters-types.js';

export interface SmartRecruitersFetcherConfig {
  readonly company: string;
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class SmartRecruitersFetcher implements Fetcher {
  private readonly company: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: SmartRecruitersFetcherConfig) {
    this.company = config.company;
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('smartrecruiters.fetcher.search', {
      providerId: 'smartrecruiters',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching SmartRecruiters jobs', {
        providerId: 'smartrecruiters',
        operation: 'search',
        query: criteria.query,
      });

      const allJobs: RawJob[] = [];
      let offset = 0;
      const limit = 100;
      const maxOffset = 1000;

      while (offset < maxOffset) {
        const url = this.buildSearchUrl(criteria, offset, limit);
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
          span.setAttribute('error', true);
          span.setAttribute('http.status', response.status);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: SmartRecruitersResponse = await response.json() as SmartRecruitersResponse;
        const jobs = this.parseResponse(data);

        if (jobs.length === 0) break;

        allJobs.push(...jobs);
        offset += limit;

        if (offset >= data.totalFound) break;
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'smartrecruiters',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, {
        providerId: 'smartrecruiters',
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
        providerId: 'smartrecruiters',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'smartrecruiters',
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
    const span = this.tracer.startSpan('smartrecruiters.fetcher.getVacancy', {
      providerId: 'smartrecruiters',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching SmartRecruiters vacancy', {
        providerId: 'smartrecruiters',
        operation: 'getVacancy',
        sourceId,
      });

      const url = `${this.baseUrl}/companies/${this.company}/postings/${sourceId}`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        span.setAttribute('found', false);
        span.end();
        return { ok: true, data: null, meta: { durationMs: Date.now() - startTime } };
      }

      const data = await response.json() as Record<string, unknown>;
      const jobs = this.parseResponse({ content: [data] as never[], totalFound: 1, offset: 0, limit: 1 });
      const durationMs = Date.now() - startTime;

      span.setAttribute('found', jobs.length > 0);
      span.end();

      return { ok: true, data: jobs[0] ?? null, meta: { durationMs } };
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
    const span = this.tracer.startSpan('smartrecruiters.fetcher.fetchWithCursor', {
      providerId: 'smartrecruiters',
    });

    const startTime = Date.now();

    try {
      let offset = 0;
      let limit = 100;

      if (cursor.type === 'offset') {
        offset = cursor.offset;
        limit = cursor.limit;
      }

      const url = this.buildSearchUrl(criteria, offset, limit);
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SmartRecruitersResponse = await response.json() as SmartRecruitersResponse;
      const jobs = this.parseResponse(data);
      const durationMs = Date.now() - startTime;

      const nextOffset = offset + limit;
      const hasMore = nextOffset < data.totalFound;

      const cursorState: CursorState = {
        cursor: {
          type: 'offset',
          offset: nextOffset,
          limit,
        },
        strategy: 'offset',
        exhausted: !hasMore,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore,
        meta: { totalResults: data.totalFound, offset, limit },
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
    const span = this.tracer.startSpan('smartrecruiters.fetcher.ping', {
      providerId: 'smartrecruiters',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging SmartRecruiters API', {
        providerId: 'smartrecruiters',
        operation: 'ping',
      });

      const url = `${this.baseUrl}/companies/${this.company}/postings?limit=1`;
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

  private buildSearchUrl(criteria: SearchCriteria, offset: number, limit: number): string {
    const url = new URL(`${this.baseUrl}/companies/${this.company}/postings`);

    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(limit));

    if (criteria.query) {
      url.searchParams.set('q', criteria.query);
    }

    return url.toString();
  }

  private parseResponse(data: SmartRecruitersResponse): RawJob[] {
    if (!data.content || !Array.isArray(data.content)) {
      return [];
    }

    const jobs: RawJob[] = [];
    const now = new Date();

    for (const posting of data.content) {
      if (!this.isValidPosting(posting)) {
        continue;
      }

      const rawJob: RawJob = {
        sourceId: posting.id,
        title: posting.name,
        description: posting.description,
        companyName: posting.department?.name ?? 'Unknown',
        location: [posting.city, posting.country].filter(Boolean).join(', ') || 'Unknown',
        salary: this.parseSalary(posting.salary),
        technologies: [],
        url: posting.applyUrl,
        publishedAt: new Date(posting.releasedDate),
        fetchedAt: now,
        extensions: {
          department: posting.department?.name,
          occupationArea: posting.occupationArea?.name,
          experienceLevel: posting.experienceLevel?.name,
          employmentType: posting.employmentType?.name,
          country: posting.country,
          city: posting.city,
          language: posting.language,
        },
      };

      jobs.push(rawJob);
    }

    return jobs;
  }

  private isValidPosting(posting: Record<string, unknown>): boolean {
    return (
      typeof posting === 'object' &&
      posting !== null &&
      typeof posting['id'] === 'string' &&
      typeof posting['name'] === 'string'
    );
  }

  private parseSalary(salary: { min?: number | null; max?: number | null; currency?: string } | null): RawJob['salary'] | undefined {
    if (!salary) return undefined;
    if (!salary.min && !salary.max) return undefined;

    return {
      from: salary.min ?? undefined,
      to: salary.max ?? undefined,
      currency: salary.currency ?? 'USD',
      period: 'yearly',
    };
  }
}

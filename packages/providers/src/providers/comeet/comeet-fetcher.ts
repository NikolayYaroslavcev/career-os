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
import type { ComeetResponse } from './comeet-types.js';

export interface ComeetFetcherConfig {
  readonly token: string;
  readonly companyUid: string;
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class ComeetFetcher implements Fetcher {
  private readonly token: string;
  private readonly companyUid: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: ComeetFetcherConfig) {
    this.token = config.token;
    this.companyUid = config.companyUid;
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('comeet.fetcher.search', {
      providerId: 'comeet',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Comeet jobs', {
        providerId: 'comeet',
        operation: 'search',
        query: criteria.query,
      });

      const url = this.buildSearchUrl(criteria);
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        span.setAttribute('error', true);
        span.setAttribute('http.status', response.status);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ComeetResponse = await response.json() as ComeetResponse;
      const jobs = this.parseResponse(data);

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'comeet',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, {
        providerId: 'comeet',
      });

      span.setAttribute('jobs.fetched', jobs.length);
      span.setAttribute('duration_ms', durationMs);
      span.end();

      const meta: ResultMeta = {
        durationMs,
        providerMeta: { totalJobs: jobs.length },
      };

      return { ok: true, data: jobs, meta };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'comeet',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'comeet',
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
    const span = this.tracer.startSpan('comeet.fetcher.getVacancy', {
      providerId: 'comeet',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Comeet vacancy', {
        providerId: 'comeet',
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
    _cursor: SyncCursor,
  ): Promise<ProviderResult<FetchResult>> {
    const span = this.tracer.startSpan('comeet.fetcher.fetchWithCursor', {
      providerId: 'comeet',
    });

    const startTime = Date.now();

    try {
      const result = await this.search(criteria);
      if (!result.ok) {
        span.end();
        return result;
      }

      const durationMs = Date.now() - startTime;

      const cursorState: CursorState = {
        cursor: {
          type: 'none',
          message: 'Comeet returns all jobs at once',
        },
        strategy: 'none',
        exhausted: true,
        fetchedCount: result.data.length,
      };

      const fetchResult: FetchResult = {
        jobs: result.data,
        cursor: cursorState,
        hasMore: false,
        meta: { totalJobs: result.data.length },
      };

      span.setAttribute('jobs.fetched', result.data.length);
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
    const span = this.tracer.startSpan('comeet.fetcher.ping', {
      providerId: 'comeet',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging Comeet API', {
        providerId: 'comeet',
        operation: 'ping',
      });

      const url = `${this.baseUrl}/company/${this.companyUid}/positions?token=${this.token}`;
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

  private buildSearchUrl(_criteria: SearchCriteria): string {
    // Comeet's Careers API has no server-side keyword filter; `details=true`
    // is required to get the job description (omitted by default to keep
    // the list-all-positions response small).
    return `${this.baseUrl}/company/${this.companyUid}/positions?token=${this.token}&details=true`;
  }

  private parseResponse(data: ComeetResponse): RawJob[] {
    if (!Array.isArray(data)) {
      return [];
    }

    const jobs: RawJob[] = [];
    const now = new Date();

    for (const job of data) {
      if (!this.isValidJob(job)) {
        continue;
      }

      const isRemote = job.workplace_type?.toLowerCase() === 'remote' || job.location?.is_remote === true;

      const rawJob: RawJob = {
        sourceId: job.uid,
        title: job.name,
        description: this.extractDescription(job.details),
        companyName: job.company_name ?? 'Unknown',
        location: job.location?.name ?? 'Unknown',
        technologies: [],
        url: job.url_active_page || job.position_url,
        publishedAt: new Date(job.time_updated),
        fetchedAt: now,
        remote: isRemote,
        extensions: {
          department: job.department,
          employmentType: job.employment_type,
        },
      };

      jobs.push(rawJob);
    }

    return jobs;
  }

  private extractDescription(details: ComeetResponse[number]['details']): string {
    if (!details) return '';
    return details
      .map((section) => section.value)
      .filter((value): value is string => Boolean(value))
      .join('\n\n');
  }

  private isValidJob(job: Record<string, unknown>): boolean {
    return (
      typeof job === 'object' &&
      job !== null &&
      typeof job['uid'] === 'string' &&
      typeof job['name'] === 'string'
    );
  }
}

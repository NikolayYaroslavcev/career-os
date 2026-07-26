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

export interface AshbyFetcherConfig {
  readonly baseUrl: string;
  readonly jobBoardName: string;
  readonly companyName: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export type AshbyEmploymentType = 'FullTime' | 'PartTime' | 'Intern' | 'Contract' | 'Temporary';

export interface AshbyRawJob {
  readonly id: string;
  readonly title: string;
  readonly departmentName?: string | null;
  readonly teamName?: string | null;
  readonly locationName: string;
  readonly isRemote: boolean;
  readonly descriptionHtml: string;
  readonly publishedAt: string;
  readonly employmentType?: AshbyEmploymentType;
  readonly jobUrl: string;
  readonly applyUrl?: string;
}

export interface AshbyJobsResponse {
  readonly jobs: readonly AshbyRawJob[];
  readonly apiVersion?: string;
}

const EMPLOYMENT_TYPE_MAP: Record<AshbyEmploymentType, string> = {
  FullTime: 'full_time',
  PartTime: 'part_time',
  Intern: 'internship',
  Contract: 'contract',
  Temporary: 'contract',
};

export class AshbyFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly jobBoardName: string;
  private readonly companyName: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: AshbyFetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.jobBoardName = config.jobBoardName;
    this.companyName = config.companyName;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('ashby.fetcher.search', {
      providerId: 'ashby',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Ashby jobs', {
        providerId: 'ashby',
        operation: 'search',
        jobBoardName: this.jobBoardName,
      });

      const url = this.buildJobsUrl();
      const response = await fetchWithTimeout(url, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        span.setAttribute('error', true);
        span.setAttribute('http.status', response.status);

        if (response.status === 429) {
          return {
            ok: false,
            error: ProviderErrorType.RATE_LIMITED,
            message: `HTTP ${response.status}: Rate limited by Ashby API`,
            retryable: true,
            meta: { durationMs: Date.now() - startTime },
          };
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as AshbyJobsResponse;
      const jobs = this.parseResponse(data).filter((job) => matchesCriteria(job, criteria));

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'ashby',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, {
        providerId: 'ashby',
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
        providerId: 'ashby',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'ashby',
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

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const span = this.tracer.startSpan('ashby.fetcher.getVacancy', {
      providerId: 'ashby',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Ashby vacancy', {
        providerId: 'ashby',
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
    const span = this.tracer.startSpan('ashby.fetcher.fetchWithCursor', {
      providerId: 'ashby',
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
          message: 'Ashby job board API returns the full board listing in one call',
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
    const span = this.tracer.startSpan('ashby.fetcher.ping', {
      providerId: 'ashby',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging Ashby API', {
        providerId: 'ashby',
        operation: 'ping',
      });

      const response = await fetchWithTimeout(this.buildJobsUrl(), { method: 'HEAD' });
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

  private buildJobsUrl(): string {
    return `${this.baseUrl}/${this.jobBoardName}?includeCompensation=true`;
  }

  private parseResponse(data: AshbyJobsResponse): RawJob[] {
    if (!data || !Array.isArray(data.jobs)) {
      throw new Error('Response is not a valid Ashby job board payload');
    }

    const jobs: RawJob[] = [];
    for (const item of data.jobs) {
      const job = this.parseSingleJob(item);
      if (job) jobs.push(job);
    }
    return jobs;
  }

  private parseSingleJob(item: AshbyRawJob): RawJob | null {
    if (!this.isValidJob(item)) {
      return null;
    }

    return {
      sourceId: String(item.id),
      title: item.title,
      description: item.descriptionHtml,
      companyName: this.companyName,
      location: item.locationName ?? '',
      salary: undefined,
      technologies: [],
      url: item.jobUrl,
      publishedAt: new Date(item.publishedAt),
      fetchedAt: new Date(),
      remote: item.isRemote,
      employmentType: this.mapEmploymentType(item.employmentType),
      extensions: {
        departmentName: item.departmentName ?? undefined,
        teamName: item.teamName ?? undefined,
        applyUrl: item.applyUrl,
      },
    };
  }

  private isValidJob(item: unknown): item is AshbyRawJob {
    return (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'title' in item &&
      'descriptionHtml' in item &&
      'jobUrl' in item
    );
  }

  private mapEmploymentType(type: AshbyEmploymentType | undefined): string | undefined {
    if (!type) return undefined;
    return EMPLOYMENT_TYPE_MAP[type];
  }
}

function matchesCriteria(job: RawJob, criteria: SearchCriteria): boolean {
  if (criteria.query) {
    const query = criteria.query.toLowerCase();
    if (!job.title.toLowerCase().includes(query) && !job.description.toLowerCase().includes(query)) {
      return false;
    }
  }

  if (criteria.remoteOnly && !job.remote) {
    return false;
  }

  if (criteria.location) {
    const location = criteria.location.toLowerCase();
    if (!job.location.toLowerCase().includes(location)) {
      return false;
    }
  }

  return true;
}

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
import {
  fetchAshbyJobBoard,
  pingAshbyJobBoard,
  parseAshbyJobsResponse,
  AtsHttpError,
  type AtsRawJob,
  type AshbyJobPayload,
  type AshbyEmploymentTypePayload,
} from '@careeros/ats-adapters';

export interface AshbyFetcherConfig {
  readonly baseUrl: string;
  readonly jobBoardName: string;
  readonly companyName: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

const EMPLOYMENT_TYPE_MAP: Record<AshbyEmploymentTypePayload, string> = {
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

      const payload = await fetchAshbyJobBoard(this.transportConfig());
      const jobs = parseAshbyJobsResponse(payload)
        .map((raw) => this.toRawJob(raw))
        .filter((job) => matchesCriteria(job, criteria));

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

      if (error instanceof AtsHttpError) {
        if (error.status === 429) {
          return {
            ok: false,
            error: ProviderErrorType.RATE_LIMITED,
            message: `HTTP ${error.status}: Rate limited by Ashby API`,
            retryable: true,
            meta: { durationMs },
          };
        }

        return {
          ok: false,
          error: ProviderErrorType.NETWORK_ERROR,
          message: `HTTP ${error.status}: ${error.statusText}`,
          retryable: true,
          meta: { durationMs },
        };
      }

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

      const ok = await pingAshbyJobBoard(this.transportConfig());
      const durationMs = Date.now() - startTime;

      span.setAttribute('http.status', ok ? 200 : 0);
      span.end();

      return { ok: true, data: ok, meta: { durationMs } };
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

  private transportConfig(): { jobBoardName: string; baseUrl: string } {
    return { jobBoardName: this.jobBoardName, baseUrl: this.baseUrl };
  }

  private toRawJob(raw: AtsRawJob): RawJob {
    const item = raw.rawMetadata as AshbyJobPayload;

    return {
      sourceId: raw.externalId,
      title: raw.title,
      description: raw.description,
      companyName: this.companyName,
      location: raw.location ?? '',
      salary: undefined,
      technologies: [],
      url: raw.url,
      publishedAt: raw.publishedAt ?? new Date(item.publishedAt),
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

  private mapEmploymentType(type: AshbyEmploymentTypePayload | undefined): string | undefined {
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

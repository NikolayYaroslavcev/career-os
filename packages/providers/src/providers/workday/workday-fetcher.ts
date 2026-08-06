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
  fetchWorkdayJobsPage,
  pingWorkdayJobs,
  parseWorkdayJobsResponse,
  AtsHttpError,
  type AtsRawJob,
} from '@careeros/ats-adapters';

const DEFAULT_PAGE_SIZE = 20;
// Safety cap on total jobs fetched in a single search() call, to avoid an
// unbounded loop if a misbehaving server keeps reporting more results than
// it actually returns.
const MAX_JOBS_SAFETY_CAP = 500;

export interface WorkdayFetcherConfig {
  readonly tenant: string;
  readonly site: string;
  readonly host: string;
  readonly companyName: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class WorkdayFetcher implements Fetcher {
  private readonly tenant: string;
  private readonly site: string;
  private readonly host: string;
  private readonly companyName: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: WorkdayFetcherConfig) {
    this.tenant = config.tenant;
    this.site = config.site;
    this.host = config.host;
    this.companyName = config.companyName;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('workday.fetcher.search', {
      providerId: 'workday',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Workday jobs', {
        providerId: 'workday',
        operation: 'search',
        tenant: this.tenant,
        site: this.site,
      });

      const limit = criteria.limit ?? DEFAULT_PAGE_SIZE;
      const allJobs: RawJob[] = [];
      const seenIds = new Set<string>();
      let offset = 0;
      let hasMore = true;

      while (hasMore && allJobs.length < MAX_JOBS_SAFETY_CAP) {
        const payload = await fetchWorkdayJobsPage(this.transportConfig(), offset, limit, criteria.query ?? '');
        const jobs = parseWorkdayJobsResponse(this.transportConfig(), payload).map((raw) => this.toRawJob(raw));

        for (const job of jobs) {
          if (!seenIds.has(job.sourceId)) {
            seenIds.add(job.sourceId);
            allJobs.push(job);
          }
        }

        offset += limit;
        hasMore = jobs.length > 0 && offset < payload.total;
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'workday',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, {
        providerId: 'workday',
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
        providerId: 'workday',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'workday',
      });

      span.setAttribute('error', true);
      span.end();

      if (error instanceof AtsHttpError) {
        if (error.status === 429) {
          return {
            ok: false,
            error: ProviderErrorType.RATE_LIMITED,
            message: `HTTP ${error.status}: Rate limited by Workday API`,
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
    const span = this.tracer.startSpan('workday.fetcher.getVacancy', {
      providerId: 'workday',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Workday vacancy', {
        providerId: 'workday',
        operation: 'getVacancy',
        sourceId,
      });

      // Workday's CXS API has no single-job-by-id endpoint reachable from just
      // a sourceId (it requires the full externalPath), so we search and find.
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
    const span = this.tracer.startSpan('workday.fetcher.fetchWithCursor', {
      providerId: 'workday',
    });

    const startTime = Date.now();

    try {
      let offset = 0;
      let limit = DEFAULT_PAGE_SIZE;
      if (cursor.type === 'offset') {
        offset = cursor.offset;
        limit = cursor.limit;
      }

      const payload = await fetchWorkdayJobsPage(this.transportConfig(), offset, limit, criteria.query ?? '');
      const jobs = parseWorkdayJobsResponse(this.transportConfig(), payload).map((raw) => this.toRawJob(raw));
      const durationMs = Date.now() - startTime;

      const hasMore = offset + payload.jobPostings.length < payload.total;

      const cursorState: CursorState = {
        cursor: {
          type: 'offset',
          offset: offset + limit,
          limit,
          totalResults: payload.total,
        },
        strategy: 'offset',
        exhausted: !hasMore,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore,
        meta: { totalJobs: payload.total },
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
    const span = this.tracer.startSpan('workday.fetcher.ping', {
      providerId: 'workday',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging Workday API', {
        providerId: 'workday',
        operation: 'ping',
      });

      const ok = await pingWorkdayJobs(this.transportConfig());
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

  private transportConfig(): { tenant: string; site: string; host: string } {
    return { tenant: this.tenant, site: this.site, host: this.host };
  }

  private toRawJob(raw: AtsRawJob): RawJob {
    const item = raw.rawMetadata as { bulletFields?: readonly string[]; jobReqId: string } | undefined;
    const locationsText = raw.location ?? '';

    return {
      sourceId: raw.externalId,
      title: raw.title,
      description: raw.description,
      companyName: this.companyName,
      location: locationsText,
      technologies: [],
      url: raw.url,
      publishedAt: raw.publishedAt ?? new Date(),
      fetchedAt: new Date(),
      remote: /remote/i.test(locationsText),
      extensions: {
        bulletFields: item?.bulletFields ?? [],
        jobReqId: item?.jobReqId,
      },
    };
  }
}

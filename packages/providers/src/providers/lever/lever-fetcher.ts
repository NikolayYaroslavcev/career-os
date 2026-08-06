import type { Fetcher, FetchResult } from '../../interfaces/fetcher.js';
import type { ProviderResult, ResultMeta } from '../../interfaces/result.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import type { SearchCriteria } from '../../interfaces/search-criteria.js';
import type { SyncCursor, CursorState, OffsetCursor } from '../../interfaces/sync-cursor.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { PROVIDER_METRICS } from '../../observability/metrics.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import {
  fetchLeverPostingsPage,
  pingLeverPostingsPage,
  parseLeverJob,
  isValidLeverPosting,
  AtsHttpError,
  type AtsRawJob,
  type LeverPostingPayload,
} from '@careeros/ats-adapters';

const DEFAULT_PAGE_LIMIT = 100;

export interface LeverFetcherConfig {
  readonly baseUrl: string;
  readonly company: string;
  readonly companyName: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class LeverFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly company: string;
  private readonly companyName: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: LeverFetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.company = config.company;
    this.companyName = config.companyName;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('lever.fetcher.search', {
      providerId: 'lever',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Lever postings', {
        providerId: 'lever',
        operation: 'search',
        company: this.company,
      });

      const limit = criteria.limit ?? DEFAULT_PAGE_LIMIT;
      const payload = await fetchLeverPostingsPage(this.transportConfig(), 0, limit);
      const jobs = this.parseJobsPayload(payload)
        .map((raw) => this.toRawJob(raw))
        .filter((job) => matchesCriteria(job, criteria));

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'lever',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, {
        providerId: 'lever',
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
        providerId: 'lever',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'lever',
      });

      span.setAttribute('error', true);
      span.end();

      if (error instanceof AtsHttpError) {
        if (error.status === 429) {
          return {
            ok: false,
            error: ProviderErrorType.RATE_LIMITED,
            message: `HTTP ${error.status}: Rate limited by Lever API`,
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

      if (message.includes('not an array') || message.includes('JSON')) {
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
    const span = this.tracer.startSpan('lever.fetcher.getVacancy', {
      providerId: 'lever',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Lever vacancy', {
        providerId: 'lever',
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
    const span = this.tracer.startSpan('lever.fetcher.fetchWithCursor', {
      providerId: 'lever',
    });

    const startTime = Date.now();

    try {
      const offsetCursor: OffsetCursor =
        cursor.type === 'offset'
          ? cursor
          : { type: 'offset', offset: 0, limit: criteria.limit ?? DEFAULT_PAGE_LIMIT };

      this.logger.info('Fetching Lever postings with cursor', {
        providerId: 'lever',
        operation: 'fetchWithCursor',
        offset: offsetCursor.offset,
        limit: offsetCursor.limit,
      });

      const payload = await fetchLeverPostingsPage(this.transportConfig(), offsetCursor.offset, offsetCursor.limit);
      const rawJobs = this.parseJobsPayload(payload).map((raw) => this.toRawJob(raw));
      const hasMore = rawJobs.length === offsetCursor.limit;
      const jobs = rawJobs.filter((job) => matchesCriteria(job, criteria));

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'lever',
        operation: 'fetchWithCursor',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, {
        providerId: 'lever',
      });

      const cursorState: CursorState = {
        cursor: {
          type: 'offset',
          offset: offsetCursor.offset + offsetCursor.limit,
          limit: offsetCursor.limit,
        },
        strategy: 'offset',
        exhausted: !hasMore,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore,
        meta: { totalJobs: jobs.length, offset: offsetCursor.offset, limit: offsetCursor.limit },
      };

      span.setAttribute('jobs.fetched', jobs.length);
      span.setAttribute('has_more', hasMore);
      span.end();

      return { ok: true, data: fetchResult, meta: { durationMs } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      span.setAttribute('error', true);
      span.end();

      if (error instanceof AtsHttpError) {
        if (error.status === 429) {
          return {
            ok: false,
            error: ProviderErrorType.RATE_LIMITED,
            message: `HTTP ${error.status}: Rate limited by Lever API`,
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

      if (message.includes('not an array') || message.includes('JSON')) {
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

  async ping(): Promise<ProviderResult<boolean>> {
    const span = this.tracer.startSpan('lever.fetcher.ping', {
      providerId: 'lever',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging Lever API', {
        providerId: 'lever',
        operation: 'ping',
      });

      const ok = await pingLeverPostingsPage(this.transportConfig(), 0, DEFAULT_PAGE_LIMIT);
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

  private transportConfig(): { company: string; baseUrl: string } {
    return { company: this.company, baseUrl: this.baseUrl };
  }

  /** Mirrors the original `parseResponse`'s array check and per-posting validity filtering. */
  private parseJobsPayload(payload: unknown): AtsRawJob[] {
    if (!Array.isArray(payload)) {
      throw new Error('Response is not an array of Lever postings');
    }

    return payload.filter(isValidLeverPosting).map((item) => parseLeverJob(item));
  }

  private toRawJob(raw: AtsRawJob): RawJob {
    const locationRaw = raw.location ?? '';
    const rawPosting = raw.rawMetadata as LeverPostingPayload | undefined;

    return {
      sourceId: raw.externalId,
      title: raw.title,
      description: raw.description,
      companyName: this.companyName,
      location: locationRaw,
      salary: raw.salary
        ? { from: raw.salary.min, to: raw.salary.max, currency: raw.salary.currency ?? 'USD', period: 'yearly' }
        : undefined,
      technologies: rawPosting?.tags ? [...rawPosting.tags] : [],
      url: raw.url,
      publishedAt: raw.publishedAt ?? new Date(0),
      fetchedAt: new Date(),
      remote: this.isRemote(rawPosting, locationRaw),
      extensions: {
        applyUrl: rawPosting?.applyUrl,
        department: rawPosting?.categories?.department,
        team: rawPosting?.categories?.team,
        commitment: rawPosting?.categories?.commitment,
        allLocations: rawPosting?.categories?.allLocations ?? [],
        workplaceType: rawPosting?.workplaceType,
      },
    };
  }

  private isRemote(rawPosting: LeverPostingPayload | undefined, locationRaw: string): boolean {
    if (rawPosting?.workplaceType === 'remote') {
      return true;
    }
    return /remote/i.test(locationRaw);
  }
}

function matchesCriteria(job: RawJob, criteria: SearchCriteria): boolean {
  if (criteria.query) {
    const query = criteria.query.toLowerCase();
    if (!job.title.toLowerCase().includes(query) && !job.description.toLowerCase().includes(query)) {
      return false;
    }
  }

  if (criteria.technologies && criteria.technologies.length > 0) {
    const jobTechs = new Set(job.technologies.map((t) => t.toLowerCase()));
    const hasMatch = criteria.technologies.some((t) => jobTechs.has(t.toLowerCase()));
    if (!hasMatch && jobTechs.size > 0) {
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

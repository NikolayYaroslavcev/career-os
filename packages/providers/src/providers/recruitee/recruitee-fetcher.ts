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
  fetchRecruiteeOffersPage,
  pingRecruiteeOffers,
  parseRecruiteeJobsResponse,
  type AtsRawJob,
  type RecruiteeOfferPayload,
} from '@careeros/ats-adapters';

const PAGE_SIZE = 50;
const MAX_PAGES = 10;

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

      while (page <= MAX_PAGES) {
        const payload = await fetchRecruiteeOffersPage(
          this.transportConfig(),
          page,
          PAGE_SIZE,
          criteria.query,
          criteria.remoteOnly,
        );
        const jobs = parseRecruiteeJobsResponse(payload).map((raw) => this.toRawJob(raw));

        if (jobs.length === 0) break;

        allJobs.push(...jobs);
        page++;

        if (page > payload.meta.total_pages) break;
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
      let perPage = PAGE_SIZE;

      if (cursor.type === 'page') {
        page = cursor.page;
        perPage = cursor.perPage;
      }

      const payload = await fetchRecruiteeOffersPage(this.transportConfig(), page, perPage, criteria.query);
      const jobs = parseRecruiteeJobsResponse(payload).map((raw) => this.toRawJob(raw));
      const durationMs = Date.now() - startTime;

      const hasMore = page < payload.meta.total_pages;

      const cursorState: CursorState = {
        cursor: {
          type: 'page',
          page: page + 1,
          perPage,
          totalPages: payload.meta.total_pages,
        },
        strategy: 'page',
        exhausted: !hasMore,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore,
        meta: { totalResults: payload.meta.total, page, totalPages: payload.meta.total_pages },
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

      const ok = await pingRecruiteeOffers(this.transportConfig());
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

  private toRawJob(raw: AtsRawJob): RawJob {
    const offer = raw.rawMetadata as RecruiteeOfferPayload;

    return {
      sourceId: raw.externalId,
      title: raw.title,
      description: raw.description,
      companyName: 'Unknown',
      location: raw.location ?? 'Unknown',
      salary: raw.salary
        ? { from: raw.salary.min, to: raw.salary.max, currency: raw.salary.currency ?? 'EUR', period: 'yearly' }
        : undefined,
      technologies: [],
      url: raw.url,
      publishedAt: raw.publishedAt ?? new Date(offer.created_at),
      fetchedAt: new Date(),
      remote: offer.remote,
      extensions: {
        employmentType: offer.employment_type,
        department: offer.department,
        team: offer.team,
        createdAt: offer.created_at,
        updatedAt: offer.updated_at,
      },
    };
  }
}

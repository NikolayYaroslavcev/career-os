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
  fetchSmartRecruitersPostingsPage,
  fetchSingleSmartRecruitersPosting,
  pingSmartRecruitersPostings,
  parseSmartRecruitersJob,
  parseSmartRecruitersJobsResponse,
  isValidSmartRecruitersPosting,
  AtsHttpError,
  type AtsRawJob,
  type SmartRecruitersPostingPayload,
} from '@careeros/ats-adapters';

const PAGE_LIMIT = 100;
const MAX_OFFSET = 1000;

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

      while (offset < MAX_OFFSET) {
        const payload = await fetchSmartRecruitersPostingsPage(this.transportConfig(), offset, PAGE_LIMIT, criteria.query);
        const jobs = parseSmartRecruitersJobsResponse(payload).map((raw) => this.toRawJob(raw));

        if (jobs.length === 0) break;

        allJobs.push(...jobs);
        offset += PAGE_LIMIT;

        if (offset >= payload.totalFound) break;
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

      let raw: SmartRecruitersPostingPayload | null;
      try {
        raw = await fetchSingleSmartRecruitersPosting(this.transportConfig(), sourceId);
      } catch (fetchError) {
        // Preserves the original fetcher's behavior: ANY non-ok HTTP response
        // (not just 404) was treated as "job not found", swallowing real
        // errors like 500/429 into a null result instead of surfacing them.
        // This diverges from Greenhouse's getVacancy (404 -> null, other
        // errors propagate as an error result) and is preserved as-is, not
        // fixed — see ADR-033 SmartRecruiters migration addendum.
        if (fetchError instanceof AtsHttpError) {
          raw = null;
        } else {
          throw fetchError;
        }
      }

      const durationMs = Date.now() - startTime;
      // Original getVacancy re-validated the fetched posting through the same
      // isValidPosting check as the listing path (via a re-used parseResponse
      // call) — mirrored here explicitly, same pattern as GreenhouseFetcher.
      const job = raw && isValidSmartRecruitersPosting(raw) ? this.toRawJob(parseSmartRecruitersJob(raw)) : null;

      span.setAttribute('found', !!job);
      span.end();

      return { ok: true, data: job, meta: { durationMs } };
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
      let limit = PAGE_LIMIT;

      if (cursor.type === 'offset') {
        offset = cursor.offset;
        limit = cursor.limit;
      }

      const payload = await fetchSmartRecruitersPostingsPage(this.transportConfig(), offset, limit, criteria.query);
      const jobs = parseSmartRecruitersJobsResponse(payload).map((raw) => this.toRawJob(raw));
      const durationMs = Date.now() - startTime;

      const nextOffset = offset + limit;
      const hasMore = nextOffset < payload.totalFound;

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
        meta: { totalResults: payload.totalFound, offset, limit },
      };

      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return {
        ok: true,
        data: fetchResult,
        meta: { durationMs },
      };
    } catch (error) {
      // Unlike search(), the original fetchWithCursor never classified HTTP
      // errors as NETWORK_ERROR — every failure here (including a thrown
      // AtsHttpError) has always fallen through to UNKNOWN_ERROR. Preserved
      // as-is; see ADR-033 SmartRecruiters migration addendum.
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

      const ok = await pingSmartRecruitersPostings(this.transportConfig());
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
    const rawPosting = raw.rawMetadata as SmartRecruitersPostingPayload | undefined;

    return {
      sourceId: raw.externalId,
      title: raw.title,
      description: raw.description,
      // Original code reads `posting.department?.name` here instead of the
      // provider's own configured company name — a pre-existing bug (the
      // job's department ends up in the "company" field), found during this
      // migration, not fixed. Preserved as-is per "keep behavior identical";
      // see ADR-033 SmartRecruiters migration addendum for the full trace.
      companyName: rawPosting?.department?.name ?? 'Unknown',
      location: raw.location ?? 'Unknown',
      salary: raw.salary
        ? { from: raw.salary.min, to: raw.salary.max, currency: raw.salary.currency ?? 'USD', period: 'yearly' }
        : undefined,
      // Technology extraction happens downstream in SmartRecruitersMapper
      // (regex over the description), not in the fetcher — matches the
      // original, unlike Greenhouse/Lever which extract at this layer.
      technologies: [],
      url: raw.url,
      publishedAt: raw.publishedAt ?? new Date(0),
      fetchedAt: new Date(),
      // Original RawJob never set `remote` for SmartRecruiters (provider
      // info declares supportsRemote: false); preserved as undefined rather
      // than deriving it from location text the way Greenhouse/Lever do.
      extensions: {
        department: rawPosting?.department?.name,
        occupationArea: rawPosting?.occupationArea?.name,
        experienceLevel: rawPosting?.experienceLevel?.name,
        employmentType: rawPosting?.employmentType?.name,
        country: rawPosting?.country,
        city: rawPosting?.city,
        language: rawPosting?.language,
      },
    };
  }
}

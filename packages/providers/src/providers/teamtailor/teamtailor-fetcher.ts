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
  fetchTeamtailorJobsPage,
  fetchSingleTeamtailorJob,
  pingTeamtailorJobs,
  parseTeamtailorJob,
  AtsHttpError,
  type AtsRawJob,
  type TeamtailorJobResourcePayload,
} from '@careeros/ats-adapters';

const DEFAULT_PAGE_SIZE = 20;
// Safety cap on pages walked in a single search() call, to avoid an
// unbounded loop if a misbehaving server keeps reporting a `next` link.
const MAX_PAGES_SAFETY_CAP = 25;

export interface TeamtailorFetcherConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly companyName: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

const CANONICAL_EMPLOYMENT_TYPES = new Set(['full_time', 'part_time', 'contract', 'freelance', 'internship']);
const CANONICAL_EXPERIENCE_LEVELS = new Set(['intern', 'junior', 'middle', 'senior', 'lead', 'principal']);

export class TeamtailorFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly companyName: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: TeamtailorFetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.companyName = config.companyName;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('teamtailor.fetcher.search', {
      providerId: 'teamtailor',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Teamtailor jobs', {
        providerId: 'teamtailor',
        operation: 'search',
      });

      const perPage = criteria.limit ?? DEFAULT_PAGE_SIZE;
      const allJobs: RawJob[] = [];
      let page = 1;
      let hasNext = true;

      while (hasNext && page <= MAX_PAGES_SAFETY_CAP) {
        const payload = await fetchTeamtailorJobsPage(this.transportConfig(), page, perPage);
        allJobs.push(...payload.data.map((item) => this.toRawJob(parseTeamtailorJob(item, payload.included))));

        hasNext = !!payload.links?.next;
        page += 1;
      }

      const filtered = allJobs.filter((job) => matchesCriteria(job, criteria));

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'teamtailor',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, filtered.length, {
        providerId: 'teamtailor',
      });

      span.setAttribute('jobs.fetched', filtered.length);
      span.setAttribute('duration_ms', durationMs);
      span.end();

      const meta: ResultMeta = { durationMs, providerMeta: { totalJobs: filtered.length } };
      return { ok: true, data: filtered, meta };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'teamtailor',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'teamtailor',
      });

      span.setAttribute('error', true);
      span.end();

      return this.toErrorResult(error, durationMs);
    }
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const span = this.tracer.startSpan('teamtailor.fetcher.getVacancy', {
      providerId: 'teamtailor',
      sourceId,
    });

    const startTime = Date.now();

    try {
      const payload = await fetchSingleTeamtailorJob(this.transportConfig(), sourceId);
      const durationMs = Date.now() - startTime;

      if (!payload) {
        span.setAttribute('found', false);
        span.end();
        return { ok: true, data: null, meta: { durationMs } };
      }

      const rawJob = this.toRawJob(parseTeamtailorJob(payload.data, payload.included));

      span.setAttribute('found', true);
      span.end();

      return { ok: true, data: rawJob, meta: { durationMs } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      span.setAttribute('error', true);
      span.end();

      if (error instanceof AtsHttpError) {
        return this.toErrorResult(error, durationMs);
      }

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
    const span = this.tracer.startSpan('teamtailor.fetcher.fetchWithCursor', {
      providerId: 'teamtailor',
    });

    const startTime = Date.now();

    try {
      const page = cursor.type === 'page' ? cursor.page : 1;
      const perPage = cursor.type === 'page' ? cursor.perPage : DEFAULT_PAGE_SIZE;

      const payload = await fetchTeamtailorJobsPage(this.transportConfig(), page, perPage);
      const jobs = payload.data
        .map((item) => this.toRawJob(parseTeamtailorJob(item, payload.included)))
        .filter((job) => matchesCriteria(job, criteria));
      const durationMs = Date.now() - startTime;
      const recordCount = payload.meta?.['record-count'];
      const hasMore = payload.links?.next
        ? true
        : recordCount !== undefined
          ? page * perPage < recordCount
          : false;

      const cursorState: CursorState = {
        cursor: { type: 'page', page: page + 1, perPage, totalResults: recordCount },
        strategy: 'page',
        exhausted: !hasMore,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore,
        meta: { totalResults: recordCount },
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
    const span = this.tracer.startSpan('teamtailor.fetcher.ping', {
      providerId: 'teamtailor',
    });

    const startTime = Date.now();

    try {
      const ok = await pingTeamtailorJobs(this.transportConfig());
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

  private transportConfig(): { apiKey: string; baseUrl: string } {
    return { apiKey: this.apiKey, baseUrl: this.baseUrl };
  }

  private toErrorResult(error: unknown, durationMs: number): ProviderResult<never> {
    if (error instanceof AtsHttpError) {
      if (error.status === 401 || error.status === 403) {
        return {
          ok: false,
          error: ProviderErrorType.AUTHENTICATION_ERROR,
          message: `HTTP ${error.status}: Invalid or missing Teamtailor API key`,
          retryable: false,
          meta: { durationMs },
        };
      }

      if (error.status === 429) {
        return {
          ok: false,
          error: ProviderErrorType.RATE_LIMITED,
          message: `HTTP ${error.status}: Rate limited by Teamtailor API`,
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
      return { ok: false, error: ProviderErrorType.INVALID_RESPONSE, message, retryable: false, meta: { durationMs } };
    }

    return { ok: false, error: ProviderErrorType.UNKNOWN_ERROR, message, retryable: false, meta: { durationMs } };
  }

  private toRawJob(raw: AtsRawJob): RawJob {
    const attributes = (raw.rawMetadata as TeamtailorJobResourcePayload).attributes;
    const employmentType = attributes['employment-type'];
    const experienceLevel = attributes['employment-level'];

    return {
      sourceId: raw.externalId,
      title: raw.title,
      description: raw.description,
      companyName: this.companyName,
      location: raw.location ?? '',
      technologies: [],
      url: raw.url,
      publishedAt: raw.publishedAt ?? new Date(attributes['created-at']),
      fetchedAt: new Date(),
      remote: attributes['remote-status'] === 'fully-remote',
      employmentType: employmentType && CANONICAL_EMPLOYMENT_TYPES.has(employmentType) ? employmentType : undefined,
      experienceLevel: experienceLevel && CANONICAL_EXPERIENCE_LEVELS.has(experienceLevel) ? experienceLevel : undefined,
      extensions: { remoteStatus: attributes['remote-status'], status: attributes.status },
    };
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

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

const DEFAULT_PAGE_SIZE = 20;
const API_VERSION = '20240404';
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

export interface TeamtailorJobAttributes {
  readonly title: string;
  readonly body?: string;
  readonly pitch?: string;
  readonly 'created-at': string;
  // Real Teamtailor jobs resolve location via a `locations` JSON:API
  // relationship (requires `include=locations` + resolving `included`).
  // We simplify here by trusting a denormalized `locationName` attribute
  // directly on the job resource instead of implementing full JSON:API
  // include-resolution plumbing, which is out of scope for this integration.
  readonly locationName?: string;
  readonly 'remote-status'?: string;
  readonly 'employment-type'?: string;
  readonly 'employment-level'?: string;
  readonly status?: string;
}

export interface TeamtailorJobLinks {
  readonly 'careersite-job-url'?: string;
}

export interface TeamtailorJobResource {
  readonly id: string;
  readonly type: string;
  readonly attributes: TeamtailorJobAttributes;
  readonly links?: TeamtailorJobLinks;
}

export interface TeamtailorJobsResponse {
  readonly data: readonly TeamtailorJobResource[];
  readonly meta?: { readonly 'record-count'?: number };
  readonly links?: { readonly next?: string };
}

export interface TeamtailorJobResponse {
  readonly data: TeamtailorJobResource;
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
        const response = await fetchWithTimeout(this.buildJobsUrl(page, perPage), { headers: this.buildHeaders() });

        if (!response.ok) {
          const failure = this.mapHttpFailure(response, Date.now() - startTime);
          if (failure) {
            span.setAttribute('error', true);
            span.setAttribute('http.status', response.status);
            return failure;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as TeamtailorJobsResponse;
        const jobs = this.parseResponse(data);
        allJobs.push(...jobs);

        hasNext = !!data.links?.next;
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

      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.startsWith('HTTP')) {
        return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message, retryable: true, meta: { durationMs } };
      }

      if (message.includes('JSON')) {
        return { ok: false, error: ProviderErrorType.INVALID_RESPONSE, message, retryable: false, meta: { durationMs } };
      }

      return { ok: false, error: ProviderErrorType.UNKNOWN_ERROR, message, retryable: false, meta: { durationMs } };
    }
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const span = this.tracer.startSpan('teamtailor.fetcher.getVacancy', {
      providerId: 'teamtailor',
      sourceId,
    });

    const startTime = Date.now();

    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/${sourceId}`, { headers: this.buildHeaders() });

      if (!response.ok) {
        if (response.status === 404) {
          span.setAttribute('found', false);
          span.end();
          return { ok: true, data: null, meta: { durationMs: Date.now() - startTime } };
        }

        const failure = this.mapHttpFailure(response, Date.now() - startTime);
        if (failure) {
          span.setAttribute('error', true);
          span.end();
          return failure;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as TeamtailorJobResponse;
      const rawJob = this.parseSingleJob(data.data);
      const durationMs = Date.now() - startTime;

      span.setAttribute('found', !!rawJob);
      span.end();

      return { ok: true, data: rawJob, meta: { durationMs } };
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
    const span = this.tracer.startSpan('teamtailor.fetcher.fetchWithCursor', {
      providerId: 'teamtailor',
    });

    const startTime = Date.now();

    try {
      const page = cursor.type === 'page' ? cursor.page : 1;
      const perPage = cursor.type === 'page' ? cursor.perPage : DEFAULT_PAGE_SIZE;

      const response = await fetchWithTimeout(this.buildJobsUrl(page, perPage), { headers: this.buildHeaders() });

      if (!response.ok) {
        const failure = this.mapHttpFailure(response, Date.now() - startTime);
        if (failure) {
          span.setAttribute('error', true);
          span.end();
          return failure;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as TeamtailorJobsResponse;
      const jobs = this.parseResponse(data).filter((job) => matchesCriteria(job, criteria));
      const durationMs = Date.now() - startTime;
      const recordCount = data.meta?.['record-count'];
      const hasMore = data.links?.next
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
      // Teamtailor doesn't reliably support HEAD on this API, so ping with a
      // minimal authenticated GET instead.
      const response = await fetchWithTimeout(`${this.baseUrl}?page%5Bsize%5D=1`, { headers: this.buildHeaders() });
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

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Token token=${this.apiKey}`,
      'X-Api-Version': API_VERSION,
      Accept: 'application/vnd.api+json',
    };
  }

  private buildJobsUrl(page: number, perPage: number): string {
    return `${this.baseUrl}?page%5Bnumber%5D=${page}&page%5Bsize%5D=${perPage}&filter%5Bstatus%5D=published`;
  }

  private mapHttpFailure(response: Response, durationMs: number): ProviderResult<never> | null {
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error: ProviderErrorType.AUTHENTICATION_ERROR,
        message: `HTTP ${response.status}: Invalid or missing Teamtailor API key`,
        retryable: false,
        meta: { durationMs },
      };
    }

    if (response.status === 429) {
      return {
        ok: false,
        error: ProviderErrorType.RATE_LIMITED,
        message: `HTTP ${response.status}: Rate limited by Teamtailor API`,
        retryable: true,
        meta: { durationMs },
      };
    }

    return null;
  }

  private parseResponse(data: TeamtailorJobsResponse): RawJob[] {
    if (!data || !Array.isArray(data.data)) {
      throw new Error('Response is not a valid Teamtailor jobs payload');
    }

    const jobs: RawJob[] = [];
    for (const item of data.data) {
      const job = this.parseSingleJob(item);
      if (job) jobs.push(job);
    }
    return jobs;
  }

  private parseSingleJob(item: TeamtailorJobResource): RawJob | null {
    if (!this.isValidJob(item)) {
      return null;
    }

    const attributes = item.attributes;
    const description = attributes.body ?? attributes.pitch ?? '';
    const employmentType = attributes['employment-type'];
    const experienceLevel = attributes['employment-level'];

    return {
      sourceId: item.id,
      title: attributes.title,
      description,
      companyName: this.companyName,
      location: attributes.locationName ?? '',
      technologies: [],
      url: item.links?.['careersite-job-url'] ?? '',
      publishedAt: new Date(attributes['created-at']),
      fetchedAt: new Date(),
      remote: attributes['remote-status'] === 'fully-remote',
      employmentType: employmentType && CANONICAL_EMPLOYMENT_TYPES.has(employmentType) ? employmentType : undefined,
      experienceLevel: experienceLevel && CANONICAL_EXPERIENCE_LEVELS.has(experienceLevel) ? experienceLevel : undefined,
      extensions: { remoteStatus: attributes['remote-status'], status: attributes.status },
    };
  }

  private isValidJob(item: unknown): item is TeamtailorJobResource {
    return (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'attributes' in item &&
      typeof (item as TeamtailorJobResource).attributes === 'object'
    );
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

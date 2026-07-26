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

export interface GreenhouseFetcherConfig {
  readonly baseUrl: string;
  readonly boardToken: string;
  readonly companyName: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export interface GreenhouseMetadataField {
  readonly id: number;
  readonly name: string;
  readonly value: string | null;
}

export interface GreenhousePayRange {
  readonly min_cents: number | null;
  readonly max_cents: number | null;
  readonly currency_type: string | null;
}

export interface GreenhouseLocation {
  readonly name: string;
}

export interface GreenhouseDepartment {
  readonly id: number;
  readonly name: string;
}

export interface GreenhouseRawJob {
  readonly id: number;
  readonly title: string;
  readonly updated_at: string;
  readonly absolute_url: string;
  readonly content: string;
  readonly location: GreenhouseLocation;
  readonly departments?: readonly GreenhouseDepartment[];
  readonly metadata?: readonly GreenhouseMetadataField[] | null;
  readonly pay_input_ranges?: readonly GreenhousePayRange[] | null;
}

export interface GreenhouseJobsResponse {
  readonly jobs: readonly GreenhouseRawJob[];
}

export class GreenhouseFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly boardToken: string;
  private readonly companyName: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: GreenhouseFetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.boardToken = config.boardToken;
    this.companyName = config.companyName;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('greenhouse.fetcher.search', {
      providerId: 'greenhouse',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching Greenhouse jobs', {
        providerId: 'greenhouse',
        operation: 'search',
        boardToken: this.boardToken,
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
            message: `HTTP ${response.status}: Rate limited by Greenhouse API`,
            retryable: true,
            meta: { durationMs: Date.now() - startTime },
          };
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as GreenhouseJobsResponse;
      const jobs = this.parseResponse(data).filter((job) => matchesCriteria(job, criteria));

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'greenhouse',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, {
        providerId: 'greenhouse',
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
        providerId: 'greenhouse',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'greenhouse',
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
    const span = this.tracer.startSpan('greenhouse.fetcher.getVacancy', {
      providerId: 'greenhouse',
      sourceId,
    });

    const startTime = Date.now();

    try {
      const url = `${this.baseUrl}/${this.boardToken}/jobs/${sourceId}?questions=false`;
      const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });

      if (!response.ok) {
        if (response.status === 404) {
          span.setAttribute('found', false);
          span.end();
          return { ok: true, data: null, meta: { durationMs: Date.now() - startTime } };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as GreenhouseRawJob;
      const rawJob = this.parseSingleJob(data);
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
    _cursor: SyncCursor,
  ): Promise<ProviderResult<FetchResult>> {
    const span = this.tracer.startSpan('greenhouse.fetcher.fetchWithCursor', {
      providerId: 'greenhouse',
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
          message: 'Greenhouse job board API returns the full board listing in one call',
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
    const span = this.tracer.startSpan('greenhouse.fetcher.ping', {
      providerId: 'greenhouse',
    });

    const startTime = Date.now();

    try {
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
    return `${this.baseUrl}/${this.boardToken}/jobs?content=true`;
  }

  private parseResponse(data: GreenhouseJobsResponse): RawJob[] {
    if (!data || !Array.isArray(data.jobs)) {
      throw new Error('Response is not a valid Greenhouse jobs payload');
    }

    const jobs: RawJob[] = [];
    for (const item of data.jobs) {
      const job = this.parseSingleJob(item);
      if (job) jobs.push(job);
    }
    return jobs;
  }

  private parseSingleJob(item: GreenhouseRawJob): RawJob | null {
    if (!this.isValidJob(item)) {
      return null;
    }

    const locationName = item.location?.name ?? '';

    return {
      sourceId: String(item.id),
      title: item.title,
      description: item.content,
      companyName: this.companyName,
      location: locationName,
      salary: this.parseSalary(item.pay_input_ranges),
      technologies: this.extractTechnologies(item.metadata),
      url: item.absolute_url,
      publishedAt: new Date(item.updated_at),
      fetchedAt: new Date(),
      remote: /remote/i.test(locationName),
      extensions: {
        departments: item.departments?.map((d) => d.name) ?? [],
      },
    };
  }

  private isValidJob(item: unknown): item is GreenhouseRawJob {
    return (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'title' in item &&
      'content' in item &&
      'absolute_url' in item
    );
  }

  private parseSalary(ranges: readonly GreenhousePayRange[] | null | undefined): RawJob['salary'] | undefined {
    const range = ranges?.[0];
    if (!range || (range.min_cents == null && range.max_cents == null)) {
      return undefined;
    }

    return {
      from: range.min_cents != null ? range.min_cents / 100 : undefined,
      to: range.max_cents != null ? range.max_cents / 100 : undefined,
      currency: range.currency_type ?? 'USD',
      period: 'yearly',
    };
  }

  private extractTechnologies(metadata: readonly GreenhouseMetadataField[] | null | undefined): string[] {
    if (!metadata) return [];

    const techFields = metadata.filter((field) => /tech(nolog(y|ies))?|skills?/i.test(field.name));
    const technologies: string[] = [];

    for (const field of techFields) {
      if (!field.value) continue;
      technologies.push(...field.value.split(',').map((t) => t.trim()).filter(Boolean));
    }

    return technologies;
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

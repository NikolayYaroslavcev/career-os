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
  fetchJobsPage,
  fetchSingleJob,
  pingBoard,
  parseJob,
  isValidGreenhouseJob,
  AtsHttpError,
  type AtsRawJob,
  type GreenhouseMetadataFieldPayload,
  type GreenhouseJobsPayload,
} from '@careeros/ats-adapters';

export interface GreenhouseFetcherConfig {
  readonly baseUrl: string;
  readonly boardToken: string;
  readonly companyName: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
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

      const payload = await fetchJobsPage(this.transportConfig());
      const jobs = this.parseJobsPayload(payload)
        .map((raw) => this.toRawJob(raw))
        .filter((job) => matchesCriteria(job, criteria));

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

      if (error instanceof AtsHttpError) {
        if (error.status === 429) {
          return {
            ok: false,
            error: ProviderErrorType.RATE_LIMITED,
            message: `HTTP ${error.status}: Rate limited by Greenhouse API`,
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

      if (message.includes('JSON') || message.includes('valid Greenhouse jobs payload')) {
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
      const raw = await fetchSingleJob(this.transportConfig(), sourceId);
      const rawJob = raw && isValidGreenhouseJob(raw) ? this.toRawJob(parseJob(raw)) : null;
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
      const ok = await pingBoard(this.transportConfig());
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

  private transportConfig(): { boardToken: string; baseUrl: string } {
    return { boardToken: this.boardToken, baseUrl: this.baseUrl };
  }

  /** Mirrors the original `parseResponse`'s shape check and per-job validity filtering. */
  private parseJobsPayload(payload: GreenhouseJobsPayload): AtsRawJob[] {
    if (!payload || !Array.isArray(payload.jobs)) {
      throw new Error('Response is not a valid Greenhouse jobs payload');
    }

    return payload.jobs.filter(isValidGreenhouseJob).map((item) => parseJob(item));
  }

  private toRawJob(raw: AtsRawJob): RawJob {
    const locationName = raw.location ?? '';

    return {
      sourceId: raw.externalId,
      title: raw.title,
      description: raw.description,
      companyName: this.companyName,
      location: locationName,
      salary: raw.salary
        ? { from: raw.salary.min, to: raw.salary.max, currency: raw.salary.currency ?? 'USD', period: 'yearly' }
        : undefined,
      technologies: extractTechnologies(raw.rawMetadata as readonly GreenhouseMetadataFieldPayload[] | null | undefined),
      url: raw.url,
      publishedAt: raw.publishedAt ?? new Date(0),
      fetchedAt: new Date(),
      remote: /remote/i.test(locationName),
      extensions: {
        departments: raw.departments ? [...raw.departments] : [],
      },
    };
  }
}

/** Consumer-owned: technology enrichment stays out of the shared canonical model (ADR-033). */
function extractTechnologies(metadata: readonly GreenhouseMetadataFieldPayload[] | null | undefined): string[] {
  if (!metadata) return [];

  const techFields = metadata.filter((field) => /tech(nolog(y|ies))?|skills?/i.test(field.name));
  const technologies: string[] = [];

  for (const field of techFields) {
    if (!field.value) continue;
    technologies.push(...field.value.split(',').map((t) => t.trim()).filter(Boolean));
  }

  return technologies;
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

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

export interface RemoteOKFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export interface RemoteOKRawJob {
  readonly id: string;
  readonly slug: string;
  readonly epoch: number;
  readonly date: string;
  readonly company: string;
  readonly company_logo: string;
  readonly position: string;
  readonly tags: readonly string[];
  readonly description: string;
  readonly location: string;
  readonly apply_url: string;
  readonly salary_min: number;
  readonly salary_max: number;
  readonly logo: string;
  readonly url: string;
}

export interface RemoteOKApiResponse {
  readonly last_updated: number;
  readonly legal: string;
}

export class RemoteOKFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: RemoteOKFetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('remoteok.fetcher.search', {
      providerId: 'remote_ok',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching RemoteOK jobs', {
        providerId: 'remote_ok',
        operation: 'search',
        query: criteria.query,
        technologies: criteria.technologies,
      });

      const tags = criteria.technologies ?? [];
      const allJobs: RawJob[] = [];
      const seenIds = new Set<string>();

      if (tags.length === 0) {
        const url = this.buildSearchUrl(criteria);
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
          span.setAttribute('error', true);
          span.setAttribute('http.status', response.status);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const jobs = this.parseResponse(data);
        for (const job of jobs) {
          if (!seenIds.has(job.sourceId)) {
            seenIds.add(job.sourceId);
            allJobs.push(job);
          }
        }
      } else {
        for (const tag of tags) {
          const tagUrl = this.buildSearchUrl({ ...criteria, technologies: [tag] });
          try {
            const response = await fetchWithTimeout(tagUrl);

            if (!response.ok) {
              this.logger.warn('RemoteOK tag fetch failed', {
                providerId: 'remote_ok',
                tag,
                status: response.status,
              });
              continue;
            }

            const data = await response.json();
            const jobs = this.parseResponse(data);
            for (const job of jobs) {
              if (!seenIds.has(job.sourceId)) {
                seenIds.add(job.sourceId);
                allJobs.push(job);
              }
            }
          } catch {
            this.logger.warn('RemoteOK tag fetch error', {
              providerId: 'remote_ok',
              tag,
            });
          }
        }
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'remote_ok',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, {
        providerId: 'remote_ok',
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
        providerId: 'remote_ok',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'remote_ok',
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
    const span = this.tracer.startSpan('remoteok.fetcher.getVacancy', {
      providerId: 'remote_ok',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching RemoteOK vacancy', {
        providerId: 'remote_ok',
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
    const span = this.tracer.startSpan('remoteok.fetcher.fetchWithCursor', {
      providerId: 'remote_ok',
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
          message: 'RemoteOK returns all jobs at once',
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
    const span = this.tracer.startSpan('remoteok.fetcher.ping', {
      providerId: 'remote_ok',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging RemoteOK API', {
        providerId: 'remote_ok',
        operation: 'ping',
      });

      const response = await fetchWithTimeout(this.baseUrl, { method: 'HEAD' });
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

  private buildSearchUrl(criteria: SearchCriteria): string {
    const url = new URL(this.baseUrl);

    const [firstTechnology] = criteria.technologies ?? [];
    if (firstTechnology) {
      url.searchParams.set('tag', firstTechnology);
    }

    return url.toString();
  }

  private parseResponse(data: unknown): RawJob[] {
    if (!Array.isArray(data)) {
      throw new Error('Response is not an array');
    }

    const jobs: RawJob[] = [];
    const now = new Date();

    for (const item of data) {
      if (!this.isValidJob(item)) {
        continue;
      }

      const rawJob: RawJob = {
        sourceId: item.id,
        title: item.position,
        description: item.description,
        companyName: item.company,
        location: item.location || 'Remote',
        salary: this.parseSalary(item.salary_min, item.salary_max),
        technologies: item.tags.map((tag) => tag.toLowerCase().trim()),
        url: item.url || item.apply_url,
        publishedAt: new Date(item.date || item.epoch * 1000),
        remote: true,
        fetchedAt: now,
        extensions: {
          slug: item.slug,
          companyLogo: item.company_logo,
          applyUrl: item.apply_url,
        },
      };

      jobs.push(rawJob);
    }

    return jobs;
  }

  private isValidJob(item: unknown): item is RemoteOKRawJob {
    return (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'position' in item &&
      'company' in item &&
      'description' in item &&
      'tags' in item &&
      Array.isArray((item as RemoteOKRawJob).tags)
    );
  }

  private parseSalary(min: number, max: number): RawJob['salary'] | undefined {
    if (min === 0 && max === 0) {
      return undefined;
    }

    return {
      from: min || undefined,
      to: max || undefined,
      currency: 'USD',
      period: 'yearly',
    };
  }
}
import type { Fetcher, FetchResult } from '../../interfaces/fetcher.js';
import type { ProviderResult } from '../../interfaces/result.js';
import type { RawJob, RawSalary } from '../../interfaces/raw-job.js';
import type { SearchCriteria } from '../../interfaces/search-criteria.js';
import type { SyncCursor, CursorState } from '../../interfaces/sync-cursor.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { PROVIDER_METRICS } from '../../observability/metrics.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import { resilientFetch, fetchWithTimeout } from '../../resilience/resilient-fetch.js';
import type { HimalayasApiResponse, HimalayasJob } from './himalayas-types.js';

export interface HimalayasFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class HimalayasFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: HimalayasFetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('himalayas.fetcher.search', { providerId: 'himalayas' });
    const startTime = Date.now();

    try {
      this.logger.info('Fetching Himalayas jobs', { providerId: 'himalayas', operation: 'search' });

      const allJobs: RawJob[] = [];
      const seenIds = new Set<string>();
      const limit = 20;
      let offset = 0;
      let hasMore = true;
      let page = 1;

      while (hasMore && page <= 5) {
        const url = new URL(this.baseUrl);
        url.searchParams.set('offset', String(offset));
        url.searchParams.set('limit', String(limit));
        if (criteria.query) url.searchParams.set('search', criteria.query);

        const response = await resilientFetch(url.toString(), 'himalayas');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const data = await response.json() as HimalayasApiResponse;
        const jobs = this.parseJobs(data);

        for (const job of jobs) {
          if (!seenIds.has(job.sourceId)) {
            seenIds.add(job.sourceId);
            allJobs.push(job);
          }
        }

        offset += limit;
        hasMore = jobs.length > 0 && offset < (data.totalCount ?? 0);
        page++;
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'himalayas', status: 'success' });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, { providerId: 'himalayas' });
      span.setAttribute('jobs.fetched', allJobs.length);
      span.end();

      return { ok: true, data: allJobs, meta: { durationMs, providerMeta: { totalJobs: allJobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'himalayas' });
      span.setAttribute('error', true);
      span.end();
      const message = error instanceof Error ? error.message : 'Unknown error';
      const errorType = message.startsWith('HTTP') ? ProviderErrorType.NETWORK_ERROR : ProviderErrorType.UNKNOWN_ERROR;
      return { ok: false, error: errorType, message, retryable: true, meta: { durationMs } };
    }
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const result = await this.search({});
    if (!result.ok) return result;
    return { ok: true, data: result.data.find((j) => j.sourceId === sourceId) ?? null, meta: result.meta };
  }

  async fetchWithCursor(criteria: SearchCriteria, cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    const span = this.tracer.startSpan('himalayas.fetcher.fetchWithCursor', { providerId: 'himalayas' });
    const startTime = Date.now();

    try {
      const limit = cursor.type === 'offset' ? cursor.limit : 20;
      const offset = cursor.type === 'offset' ? cursor.offset : 0;
      const url = new URL(this.baseUrl);
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('limit', String(limit));
      if (criteria.query) url.searchParams.set('search', criteria.query);

      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json() as HimalayasApiResponse;
      const jobs = this.parseJobs(data);

      const durationMs = Date.now() - startTime;
      const hasMore = jobs.length > 0 && offset + limit < (data.totalCount ?? 0);

      const cursorState: CursorState = {
        cursor: { type: 'offset', offset, limit },
        strategy: 'offset',
        exhausted: !hasMore,
        fetchedCount: jobs.length,
      };

      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: { jobs, cursor: cursorState, hasMore, meta: { totalJobs: data.totalCount } }, meta: { durationMs } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      span.setAttribute('error', true);
      span.end();
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: ProviderErrorType.UNKNOWN_ERROR, message, retryable: false, meta: { durationMs } };
    }
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const startTime = Date.now();
    try {
      const response = await resilientFetch(this.baseUrl, 'himalayas', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private parseJobs(data: HimalayasApiResponse): RawJob[] {
    const now = new Date();
    return (data.jobs ?? []).map((job) => {
      const url = job.applicationLink || job.guid || '';
      return {
        sourceId: job.guid || url || `${job.companySlug ?? 'unknown'}-${job.title ?? ''}-${job.pubDate ?? ''}`,
        title: job.title ?? '',
        description: job.description || job.excerpt || '',
        companyName: job.companyName ?? '',
        location: (job.locationRestrictions ?? []).join(', ') || 'Remote',
        salary: this.parseSalary(job),
        technologies: (job.categories ?? job.parentCategories ?? []).map((t) => t.toLowerCase().trim()),
        url,
        publishedAt: job.pubDate ? new Date(job.pubDate * 1000) : now,
        remote: true,
        fetchedAt: now,
        extensions: { logo: job.companyLogo, jobType: job.employmentType, seniority: job.seniority?.join(', ') },
      };
    });
  }

  private parseSalary(job: HimalayasJob): RawJob['salary'] | undefined {
    if (!job.minSalary && !job.maxSalary) return undefined;
    return {
      from: job.minSalary ?? undefined,
      to: job.maxSalary ?? undefined,
      currency: job.currency || 'USD',
      period: this.mapSalaryPeriod(job.salaryPeriod),
    };
  }

  private mapSalaryPeriod(period?: string): RawSalary['period'] {
    switch (period) {
      case 'hour': return 'hourly';
      case 'month': return 'monthly';
      case 'annual': return 'yearly';
      default: return 'unknown';
    }
  }
}

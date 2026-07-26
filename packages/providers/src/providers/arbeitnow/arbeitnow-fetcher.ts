import type { Fetcher, FetchResult } from '../../interfaces/fetcher.js';
import type { ProviderResult } from '../../interfaces/result.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import type { SearchCriteria } from '../../interfaces/search-criteria.js';
import type { SyncCursor, CursorState } from '../../interfaces/sync-cursor.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { PROVIDER_METRICS } from '../../observability/metrics.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import { resilientFetch, fetchWithTimeout } from '../../resilience/resilient-fetch.js';

export interface ArbeitnowJob {
  readonly id: number;
  readonly url: string;
  readonly title: string;
  readonly company_name: string;
  readonly description: string;
  readonly remote: boolean;
  readonly tags: readonly string[];
  readonly job_types: readonly string[];
  readonly date: string;
  readonly location: string;
  readonly salary: string;
}

export interface ArbeitnowApiResponse {
  readonly data: readonly ArbeitnowJob[];
  readonly meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface ArbeitnowFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class ArbeitnowFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: ArbeitnowFetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('arbeitnow.fetcher.search', { providerId: 'arbeitnow' });
    const startTime = Date.now();

    try {
      this.logger.info('Fetching Arbeitnow jobs', { providerId: 'arbeitnow', operation: 'search' });

      const allJobs: RawJob[] = [];
      const seenIds = new Set<string>();
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 10) {
        const url = new URL(this.baseUrl);
        url.searchParams.set('page', String(page));

        const response = await resilientFetch(url.toString(), 'arbeitnow');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const data = await response.json() as ArbeitnowApiResponse;
        const jobs = this.parseJobs(data);

        for (const job of jobs) {
          if (!seenIds.has(job.sourceId)) {
            seenIds.add(job.sourceId);
            allJobs.push(job);
          }
        }

        hasMore = page < (data.meta?.last_page ?? 1);
        page++;
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'arbeitnow', status: 'success' });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, { providerId: 'arbeitnow' });
      span.setAttribute('jobs.fetched', allJobs.length);
      span.end();

      return { ok: true, data: allJobs, meta: { durationMs, providerMeta: { totalJobs: allJobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'arbeitnow' });
      span.setAttribute('error', true);
      span.end();
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: message.startsWith('HTTP') ? ProviderErrorType.NETWORK_ERROR : ProviderErrorType.UNKNOWN_ERROR, message, retryable: true, meta: { durationMs } };
    }
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const result = await this.search({});
    if (!result.ok) return result;
    return { ok: true, data: result.data.find((j) => j.sourceId === sourceId) ?? null, meta: result.meta };
  }

  async fetchWithCursor(criteria: SearchCriteria, cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    const pageCursor = cursor.type === 'page' ? cursor.page : 1;
    const url = new URL(this.baseUrl);
    url.searchParams.set('page', String(pageCursor));

    const startTime = Date.now();
    try {
      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json() as ArbeitnowApiResponse;
      const jobs = this.parseJobs(data);
      const durationMs = Date.now() - startTime;
      const hasMore = pageCursor < (data.meta?.last_page ?? 1);

      const cursorState: CursorState = { cursor: { type: 'page', page: pageCursor, perPage: data.meta?.per_page ?? 20 }, strategy: 'page', exhausted: !hasMore, fetchedCount: jobs.length };
      return { ok: true, data: { jobs, cursor: cursorState, hasMore, meta: { totalJobs: data.meta?.total ?? 0 } }, meta: { durationMs } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return { ok: false, error: ProviderErrorType.UNKNOWN_ERROR, message: error instanceof Error ? error.message : 'Unknown', retryable: false, meta: { durationMs } };
    }
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const startTime = Date.now();
    try {
      const response = await resilientFetch(this.baseUrl, 'arbeitnow', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private parseJobs(data: ArbeitnowApiResponse): RawJob[] {
    const now = new Date();
    return (data.data ?? []).map((job) => ({
      sourceId: String(job.id),
      title: job.title,
      description: job.description,
      companyName: job.company_name,
      location: job.location || 'Remote',
      technologies: (job.tags ?? []).map((t) => t.toLowerCase().trim()),
      url: job.url,
      publishedAt: new Date(job.date),
      remote: job.remote,
      fetchedAt: now,
      extensions: { jobTypes: job.job_types, salaryRaw: job.salary },
    }));
  }
}

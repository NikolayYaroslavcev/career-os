import type { Fetcher, FetchResult } from '../../interfaces/fetcher.js';
import type { ProviderResult } from '../../interfaces/result.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import type { SearchCriteria } from '../../interfaces/search-criteria.js';
import type { SyncCursor } from '../../interfaces/sync-cursor.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { PROVIDER_METRICS } from '../../observability/metrics.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import { resilientFetch } from '../../resilience/resilient-fetch.js';

export interface WorkingNomadsJob {
  readonly title?: string;
  // The live API returns a comma-separated string, not an array.
  readonly tags?: string;
  readonly company_name?: string;
  readonly company_logo?: string;
  readonly category_name?: string;
  readonly url?: string;
  readonly location?: string;
  readonly pub_date?: string;
  readonly description?: string;
}

export interface WorkingNomadsFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class WorkingNomadsFetcher implements Fetcher {
  constructor(private readonly config: WorkingNomadsFetcherConfig) {}

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('workingnomads.fetcher.search', { providerId: 'working_nomads' });
    const startTime = Date.now();

    try {
      this.config.logger.info('Fetching Working Nomads jobs', { providerId: 'working_nomads', operation: 'search' });

      const response = await resilientFetch(this.config.baseUrl, 'working_nomads');
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json() as WorkingNomadsJob[];
      const jobs = this.parseJobs(data);

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'working_nomads', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'working_nomads' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'working_nomads' });
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

  async fetchWithCursor(criteria: SearchCriteria, _cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    const result = await this.search(criteria);
    if (!result.ok) return result;
    return { ok: true, data: { jobs: result.data, cursor: { cursor: { type: 'none', message: 'Returns all jobs' }, strategy: 'none', exhausted: true, fetchedCount: result.data.length }, hasMore: false, meta: { totalJobs: result.data.length } }, meta: result.meta };
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const startTime = Date.now();
    try {
      const response = await resilientFetch(this.config.baseUrl, 'working_nomads', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private parseJobs(data: WorkingNomadsJob[]): RawJob[] {
    const now = new Date();
    return (data ?? []).map((job) => ({
      sourceId: this.extractId(job.url) ?? job.url ?? '',
      title: job.title ?? '',
      description: job.description || job.title || '',
      companyName: job.company_name || 'Unknown',
      location: job.location || 'Remote',
      technologies: this.parseTags(job.tags, job.category_name),
      url: job.url ?? '',
      publishedAt: job.pub_date ? new Date(job.pub_date) : now,
      remote: true,
      fetchedAt: now,
      extensions: { logo: job.company_logo },
    }));
  }

  private extractId(url?: string): string | undefined {
    const match = url?.match(/\/(\d+)\/?$/);
    return match?.[1];
  }

  private parseTags(tags?: string, categoryName?: string): string[] {
    const fromTags = typeof tags === 'string' ? tags.split(',').map((t) => t.toLowerCase().trim()).filter(Boolean) : [];
    if (fromTags.length > 0) return fromTags;
    return categoryName ? [categoryName.toLowerCase().trim()] : [];
  }
}

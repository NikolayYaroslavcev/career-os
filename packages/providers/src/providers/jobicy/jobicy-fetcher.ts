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

export interface JobicyJob {
  readonly id: number;
  readonly url: string;
  readonly jobTitle?: string;
  readonly companyName?: string;
  readonly companyLogo?: string;
  readonly jobIndustry?: readonly string[];
  readonly jobType?: readonly string[];
  readonly jobGeo?: string;
  readonly jobLevel?: string;
  readonly jobExcerpt?: string;
  readonly jobDescription?: string;
  readonly pubDate?: string;
  readonly salaryMin?: number;
  readonly salaryMax?: number;
  readonly salaryCurrency?: string;
}

export interface JobicyApiResponse {
  readonly jobs: readonly JobicyJob[];
  readonly jobCount: number;
}

export interface JobicyFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class JobicyFetcher implements Fetcher {
  constructor(private readonly config: JobicyFetcherConfig) {}

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('jobicy.fetcher.search', { providerId: 'jobicy' });
    const startTime = Date.now();

    try {
      this.config.logger.info('Fetching Jobicy jobs', { providerId: 'jobicy', operation: 'search' });

      const url = new URL(this.config.baseUrl);
      url.searchParams.set('count', '50');
      const firstTech = criteria.technologies?.[0];
      if (firstTech) url.searchParams.set('tag', firstTech);

      const response = await resilientFetch(url.toString(), 'jobicy');
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json() as JobicyApiResponse;
      const jobs = this.parseJobs(data);

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'jobicy', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'jobicy' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'jobicy' });
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
      const response = await resilientFetch(this.config.baseUrl, 'jobicy', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private parseJobs(data: JobicyApiResponse): RawJob[] {
    const now = new Date();
    return (data.jobs ?? []).map((job) => ({
      sourceId: String(job.id),
      title: job.jobTitle ?? '',
      description: job.jobDescription || job.jobExcerpt || job.jobTitle || '',
      companyName: job.companyName ?? '',
      location: job.jobGeo || 'Remote',
      salary: job.salaryMin || job.salaryMax ? { from: job.salaryMin, to: job.salaryMax, currency: job.salaryCurrency || 'USD', period: 'yearly' } : undefined,
      technologies: (job.jobIndustry ?? []).map((t) => t.toLowerCase().trim()),
      url: job.url,
      publishedAt: job.pubDate ? new Date(job.pubDate) : now,
      remote: true,
      fetchedAt: now,
      extensions: { logo: job.companyLogo, jobType: job.jobType?.join(', '), experienceLevel: job.jobLevel },
    }));
  }
}

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
import { resilientFetch } from '../../resilience/resilient-fetch.js';
import type { RemotiveApiResponse } from './remotive-types.js';

export interface RemotiveFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class RemotiveFetcher implements Fetcher {
  constructor(private readonly config: RemotiveFetcherConfig) {}

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('remotive.fetcher.search', { providerId: 'remotive' });
    const startTime = Date.now();

    try {
      const url = new URL(this.config.baseUrl);
      if (criteria.query) url.searchParams.set('search', criteria.query);

      const response = await resilientFetch(url.toString(), 'remotive');
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json() as RemotiveApiResponse;
      const jobs = this.parseJobs(data);

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'remotive', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'remotive' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'remotive' });
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

  async fetchWithCursor(criteria: SearchCriteria, _cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    const result = await this.search(criteria);
    if (!result.ok) return result;

    const cursorState: CursorState = { cursor: { type: 'none', message: 'Returns all jobs' }, strategy: 'none', exhausted: true, fetchedCount: result.data.length };
    return { ok: true, data: { jobs: result.data, cursor: cursorState, hasMore: false, meta: { totalJobs: result.data.length } }, meta: result.meta };
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const startTime = Date.now();
    try {
      const response = await resilientFetch(this.config.baseUrl, 'remotive', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private parseJobs(data: RemotiveApiResponse): RawJob[] {
    const now = new Date();
    return (data.jobs ?? []).map((job) => ({
      sourceId: String(job.id),
      title: job.title ?? '',
      description: job.description ?? '',
      companyName: job.company_name ?? '',
      location: job.candidate_required_location || 'Remote',
      salary: this.parseSalary(job.salary),
      technologies: (job.tags ?? []).map((t) => t.toLowerCase().trim()),
      url: job.url,
      publishedAt: new Date(job.publication_date),
      remote: true,
      fetchedAt: now,
      extensions: { logo: job.company_logo, jobType: job.job_type, category: job.category },
    }));
  }

  private parseSalary(salary: string): RawJob['salary'] | undefined {
    if (!salary) return undefined;
    // Remotive's salary field is freeform text (e.g. "$150k - $230k", "$90 - $150 /hour",
    // "$31,2k- $52k"). Each number may carry a 'k' (thousands) suffix and use ',' as
    // either a thousands separator or a decimal point, so magnitude is inherently
    // ambiguous — parse best-effort and fall back to dropping the salary rather than
    // ever risk publishing wrong-order min/max.
    const matches = [...salary.matchAll(/(\d+(?:[.,]\d+)?)\s*(k)?/gi)];
    const nums: number[] = [];
    for (const m of matches) {
      const digits = m[1];
      if (!digits) continue;
      const hasK = Boolean(m[2]);
      // With a 'k' suffix, a single ',' is a decimal point (e.g. "31,2k" = 31200).
      // Without one, ',' is a thousands separator (e.g. "1,200" = 1200).
      const normalized = parseFloat(hasK ? digits.replace(',', '.') : digits.replace(/,/g, ''));
      if (isNaN(normalized)) continue;
      nums.push(hasK ? normalized * 1000 : normalized);
    }
    if (nums.length === 0) return undefined;

    const period = /hour/i.test(salary) ? 'hourly' : 'yearly';
    const first = nums[0]!;
    const second = nums.length > 1 ? nums[1]! : first;
    const from = Math.min(first, second);
    const to = Math.max(first, second);

    return { from, to, currency: 'USD', period };
  }
}

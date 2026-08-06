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

interface SpeedrunApiJob {
  readonly id: string;
  readonly title: string;
  readonly company: string;
  readonly url: string;
  readonly location: string | null;
  readonly workplace_type: string | null;
  readonly employment_type: string | null;
  readonly seniority: string | null;
  readonly remote: boolean;
  readonly comp_min: number | null;
  readonly comp_max: number | null;
  readonly comp_currency: string | null;
  readonly comp_period: string | null;
  readonly published_at: string;
}

interface SpeedrunApiResponse {
  readonly jobs: readonly SpeedrunApiJob[];
  readonly total: number;
  readonly page: number;
  readonly page_size: number;
  readonly total_pages: number;
}

// A hard ceiling on pagination so a server-side bug (e.g. total_pages
// reporting a huge number) can't turn one sync into an unbounded fetch loop.
const MAX_PAGES = 500;

export interface SpeedrunFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class SpeedrunFetcher implements Fetcher {
  constructor(private readonly config: SpeedrunFetcherConfig) {}

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('speedrun.fetcher.search', { providerId: 'speedrun' });
    const startTime = Date.now();

    try {
      this.config.logger.info('Fetching a16z Speedrun jobs', { providerId: 'speedrun', operation: 'search' });

      // The API silently ignores an unrecognized `function` param and
      // returns every job function (sales/ops/product/etc. included) rather
      // than erroring — `fn` is the parameter its own facet keys use and the
      // one that actually filters server-side. Without it, ~62% of the
      // 16k+ jobs on this board are non-engineering roles.
      const jobs: RawJob[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const url = `${this.config.baseUrl}?fn=engineering&page=${page}`;
        const response = await resilientFetch(url, 'speedrun');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const data = (await response.json()) as SpeedrunApiResponse;
        totalPages = Math.min(data.total_pages || 1, MAX_PAGES);
        jobs.push(...this.mapApiJobs(data.jobs));
        page += 1;
      } while (page <= totalPages);

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'speedrun', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'speedrun' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length, totalPages } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'speedrun' });
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
      const response = await resilientFetch(`${this.config.baseUrl}?fn=engineering&page=1`, 'speedrun', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private mapApiJobs(apiJobs: readonly SpeedrunApiJob[]): RawJob[] {
    const now = new Date();
    return apiJobs.map((job) => {
      const workplaceType = (job.workplace_type ?? '').toLowerCase();
      const remote = job.remote || workplaceType === 'remote';

      const parts = [job.company, job.seniority, job.employment_type, job.workplace_type, job.location].filter(Boolean);
      const description = parts.join(' — ');

      return {
        sourceId: `speedrun-${job.id}`,
        title: job.title,
        description,
        companyName: job.company || 'Unknown',
        location: job.location || (remote ? 'Remote' : 'Unknown'),
        salary: this.mapSalary(job),
        experienceLevel: this.mapSeniority(job.seniority),
        technologies: [],
        url: job.url,
        publishedAt: job.published_at ? new Date(job.published_at) : now,
        remote,
        employmentType: this.mapEmploymentType(job.employment_type),
        fetchedAt: now,
      };
    });
  }

  private mapSalary(job: SpeedrunApiJob): RawJob['salary'] | undefined {
    if (job.comp_min == null && job.comp_max == null) return undefined;
    return {
      from: job.comp_min ?? undefined,
      to: job.comp_max ?? undefined,
      currency: job.comp_currency ?? 'USD',
      period: job.comp_period === 'year' ? 'yearly' : 'unknown',
    };
  }

  private mapSeniority(raw: string | null): string | undefined {
    switch (raw) {
      case 'intern': return 'intern';
      case 'junior': return 'junior';
      case 'senior': return 'senior';
      // 'staff'/'exec'/'founding' have no clean 1:1 mapping onto CareerOS's
      // experience-level scale — left unset so the normalization pipeline's
      // own title/description text inference gets a chance instead of a
      // guessed-wrong mapping.
      default: return undefined;
    }
  }

  private mapEmploymentType(raw: string | null): string | undefined {
    switch (raw) {
      case 'FullTime': return 'full_time';
      case 'PartTime': return 'part_time';
      case 'Contract': return 'contract';
      case 'Intern': return 'internship';
      default: return undefined;
    }
  }
}

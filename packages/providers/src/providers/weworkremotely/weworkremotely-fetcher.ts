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

export interface WWRFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class WWRFetcher implements Fetcher {
  constructor(private readonly config: WWRFetcherConfig) {}

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('weworkremotely.fetcher.search', { providerId: 'we_work_remotely' });
    const startTime = Date.now();

    try {
      this.config.logger.info('Fetching We Work Remotely jobs', { providerId: 'we_work_remotely', operation: 'search' });

      const response = await resilientFetch(this.config.baseUrl, 'we_work_remotely');
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const xml = await response.text();
      const jobs = this.parseRss(xml);

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'we_work_remotely', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'we_work_remotely' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'we_work_remotely' });
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
      const response = await resilientFetch(this.config.baseUrl, 'we_work_remotely', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private parseRss(xml: string): RawJob[] {
    const now = new Date();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    return items.map((item, idx) => {
      const title = this.extractTag(item, 'title') ?? '';
      const link = this.extractTag(item, 'link') ?? '';
      const description = this.extractTag(item, 'description') ?? '';
      const pubDate = this.extractTag(item, 'pubDate') ?? '';
      const company = this.extractTag(item, 'dc:creator') ?? this.extractTag(item, 'creator') ?? '';
      const category = this.extractTag(item, 'category') ?? '';

      return {
        sourceId: `wwr-${idx}`,
        title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        description: description.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim(),
        companyName: company.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || 'Unknown',
        location: 'Remote',
        technologies: category ? category.split(',').map((c) => c.replace(/<!\[CDATA\[|\]\]>/g, '').trim().toLowerCase()).filter(Boolean) : [],
        url: link.trim(),
        publishedAt: pubDate ? new Date(pubDate) : now,
        remote: true,
        fetchedAt: now,
      };
    });
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match?.[1]?.trim() ?? null;
  }
}

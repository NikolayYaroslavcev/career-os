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

export interface PyJobsFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class PyJobsFetcher implements Fetcher {
  constructor(private readonly config: PyJobsFetcherConfig) {}

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('pyjobs.fetcher.search', { providerId: 'pyjobs' });
    const startTime = Date.now();

    try {
      this.config.logger.info('Fetching PyJobs.com jobs', { providerId: 'pyjobs', operation: 'search' });

      const response = await resilientFetch(this.config.baseUrl, 'pyjobs');
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const xml = await response.text();
      const jobs = this.parseRss(xml);

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'pyjobs', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'pyjobs' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'pyjobs' });
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
      const response = await resilientFetch(this.config.baseUrl, 'pyjobs', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private parseRss(xml: string): RawJob[] {
    const now = new Date();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    return items.map((item) => {
      const title = this.decode(this.extractTag(item, 'title') ?? '');
      const link = this.extractTag(item, 'link') ?? '';
      const rawDescription = this.decode(this.extractTag(item, 'description') ?? '');
      const pubDate = this.extractTag(item, 'pubDate') ?? '';

      // PyJobs packs company/work-mode/salary/employment-type into one
      // description line, e.g. "Acme Corp / Geo remote / $0 to $0 /
      // Full-time" — there is no separate long-form job description in the
      // feed. Salary is always "$0 to $0" in practice (unverified whether
      // it's ever populated), so it's dropped rather than parsed as real data.
      const [companyName, workMode, , employmentTypeRaw] = rawDescription.split('/').map((p) => p.trim());
      const remote = /remote/i.test(workMode ?? '');
      const slug = link.split('/').filter(Boolean).pop() ?? link;

      return {
        sourceId: `pyjobs-${slug}`,
        title,
        description: [companyName, workMode, employmentTypeRaw].filter(Boolean).join(' — '),
        companyName: companyName || 'Unknown',
        location: remote ? 'Remote' : (workMode || 'Unknown'),
        technologies: [],
        url: link.trim(),
        publishedAt: pubDate ? new Date(pubDate) : now,
        remote,
        employmentType: this.mapEmploymentType(employmentTypeRaw),
        fetchedAt: now,
      };
    });
  }

  private mapEmploymentType(raw?: string): string | undefined {
    switch (raw?.toLowerCase()) {
      case 'full-time': return 'full_time';
      case 'part-time': return 'part_time';
      case 'contractor': return 'contract';
      case 'internship': return 'internship';
      default: return undefined;
    }
  }

  private decode(text: string): string {
    return text.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match?.[1]?.trim() ?? null;
  }
}

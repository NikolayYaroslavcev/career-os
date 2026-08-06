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

export interface DjangoJobsFetcherConfig {
  // djangoproject.com/community/jobs/ aggregates these two independently-run
  // boards under one page — both ship their own feed, one RSS and one Atom,
  // so both are fetched and merged here rather than treated as separate
  // providers (matching how the research/EPIC scoped "Django Jobs" as one
  // source).
  readonly builtWithDjangoUrl: string;
  readonly djangoJobBoardUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class DjangoJobsFetcher implements Fetcher {
  constructor(private readonly config: DjangoJobsFetcherConfig) {}

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('djangojobs.fetcher.search', { providerId: 'django_jobs' });
    const startTime = Date.now();

    try {
      this.config.logger.info('Fetching Django Jobs board', { providerId: 'django_jobs', operation: 'search' });

      const [bwdResponse, djbResponse] = await Promise.all([
        resilientFetch(this.config.builtWithDjangoUrl, 'django_jobs'),
        resilientFetch(this.config.djangoJobBoardUrl, 'django_jobs'),
      ]);
      if (!bwdResponse.ok) throw new Error(`HTTP ${bwdResponse.status}: ${bwdResponse.statusText}`);
      if (!djbResponse.ok) throw new Error(`HTTP ${djbResponse.status}: ${djbResponse.statusText}`);

      const jobs = [
        ...this.parseBuiltWithDjangoRss(await bwdResponse.text()),
        ...this.parseDjangoJobBoardAtom(await djbResponse.text()),
      ];

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'django_jobs', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'django_jobs' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'django_jobs' });
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
      const response = await resilientFetch(this.config.builtWithDjangoUrl, 'django_jobs', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  /** builtwithdjango.com titles are templated as "{Job Title} at {Company}". */
  private parseBuiltWithDjangoRss(xml: string): RawJob[] {
    const now = new Date();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    return items.map((item) => {
      const rawTitle = this.decode(this.extractTag(item, 'title') ?? '');
      const link = this.extractTag(item, 'link') ?? '';
      const description = this.decode(this.extractTag(item, 'description') ?? '');
      const pubDate = this.extractTag(item, 'pubDate') ?? '';

      const match = /^(.*?)\s+at\s+(.+)$/i.exec(rawTitle);
      const title = (match?.[1] ?? rawTitle).trim();
      const companyName = (match?.[2] ?? 'Unknown').trim();
      const idMatch = /\/jobs\/(\d+)\//.exec(link);
      const sourceId = idMatch ? `django-bwd-${idMatch[1]}` : `django-bwd-${link}`;

      return {
        sourceId,
        title,
        description: description.replace(/\s+/g, ' ').trim(),
        companyName,
        location: 'Unknown',
        technologies: [],
        url: link.trim(),
        publishedAt: pubDate ? new Date(pubDate) : now,
        fetchedAt: now,
      };
    });
  }

  /**
   * djangojobboard.com's Atom feed has no separate company field — unlike
   * builtwithdjango, the company name isn't reliably splittable out of the
   * title or URL slug (e.g. "senior-full-stack-engineer-us-only-full-time-
   * 100-remote-hive-collective"), so it's left 'Unknown' rather than
   * guessed — a wrong-looking guess is worse than an honest gap.
   */
  private parseDjangoJobBoardAtom(xml: string): RawJob[] {
    const now = new Date();
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];
    return entries.map((entry) => {
      const title = this.decode(this.extractTag(entry, 'title') ?? '');
      const linkMatch = /<link\s+href="([^"]*)"/i.exec(entry);
      const link = linkMatch?.[1] ?? '';
      const summary = this.decode(this.extractTag(entry, 'summary') ?? '');
      const updated = this.extractTag(entry, 'updated') ?? '';
      const idMatch = /djangojobboard\.com\/(\d+)\//.exec(link);
      const sourceId = idMatch ? `django-djb-${idMatch[1]}` : `django-djb-${link}`;

      return {
        sourceId,
        title,
        description: summary.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        companyName: 'Unknown',
        location: 'Unknown',
        technologies: [],
        url: link.trim(),
        publishedAt: updated ? new Date(updated) : now,
        fetchedAt: now,
      };
    });
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

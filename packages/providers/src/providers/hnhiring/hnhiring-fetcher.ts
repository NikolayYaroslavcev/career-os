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

export interface HNHiringFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class HNHiringFetcher implements Fetcher {
  constructor(private readonly config: HNHiringFetcherConfig) {}

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('hnhiring.fetcher.search', { providerId: 'hn_hiring' });
    const startTime = Date.now();

    try {
      this.config.logger.info('Fetching HN Who Is Hiring jobs', { providerId: 'hn_hiring', operation: 'search' });

      // Step 1: Find the latest "Who is hiring" thread
      const searchUrl = `${this.config.baseUrl}?query=%22Ask%20HN%3A%20Who%20is%20hiring%22&tags=ask_hn&hitsPerPage=1`;
      const searchResponse = await resilientFetch(searchUrl, 'hn_hiring');
      if (!searchResponse.ok) throw new Error(`HTTP ${searchResponse.status}: ${searchResponse.statusText}`);
      const searchData = await searchResponse.json() as { hits: Array<{ objectID: string; created_at: string }> };

      if (!searchData.hits?.length) {
        return { ok: true, data: [], meta: { durationMs: Date.now() - startTime, providerMeta: { totalJobs: 0 } } };
      }

      const threadId = searchData.hits[0]?.objectID;
      if (!threadId) {
        return { ok: true, data: [], meta: { durationMs: Date.now() - startTime, providerMeta: { totalJobs: 0 } } };
      }

      // Step 2: Fetch thread and its children
      const threadUrl = `https://hacker-news.firebaseio.com/v0/item/${threadId}.json`;
      const threadResponse = await resilientFetch(threadUrl, 'hn_hiring');
      if (!threadResponse.ok) throw new Error(`HTTP ${threadResponse.status}: ${threadResponse.statusText}`);
      const thread = await threadResponse.json() as { kids?: number[] };

      if (!thread.kids?.length) {
        return { ok: true, data: [], meta: { durationMs: Date.now() - startTime, providerMeta: { totalJobs: 0 } } };
      }

      // Step 3: Fetch top comments (limit to 100)
      const commentIds = thread.kids.slice(0, 100);
      const jobs: RawJob[] = [];
      const now = new Date();

      const commentPromises = commentIds.map(async (commentId) => {
        try {
          const commentUrl = `https://hacker-news.firebaseio.com/v0/item/${commentId}.json`;
          const commentResponse = await resilientFetch(commentUrl, 'hn_hiring');
          if (!commentResponse.ok) return null;
          const comment = await commentResponse.json() as { id: number; text?: string; by?: string; time?: number };

          if (!comment.text) return null;

          // Parse job info from comment text
          const parsed = this.parseJobFromComment({ text: comment.text });
          if (parsed) {
            return {
              sourceId: `hn-${commentId}`,
              title: parsed.title,
              description: parsed.text,
              companyName: parsed.company || comment.by || 'Unknown',
              location: parsed.location || 'Remote',
              technologies: parsed.technologies,
              url: parsed.url || `https://news.ycombinator.com/item?id=${commentId}`,
              publishedAt: comment.time ? new Date(comment.time * 1000) : now,
              remote: true,
              fetchedAt: now,
            } as RawJob;
          }
          return null;
        } catch {
          return null;
        }
      });

      const results = await Promise.allSettled(commentPromises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          jobs.push(result.value);
        }
      }

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'hn_hiring', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'hn_hiring' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'hn_hiring' });
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
      const response = await resilientFetch(this.config.baseUrl, 'hn_hiring', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private parseJobFromComment(comment: { text: string }): { title: string; text: string; company: string; location: string; url: string; technologies: string[] } | null {
    const text = comment.text.replace(/<[^>]*>/g, '').trim();
    if (text.length < 20) return null;

    // Try to extract structured info from HN hiring comments
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    // First line is usually the company name or job title
    const firstLine = lines[0] ?? '';
    const company = firstLine.split('|')[0]?.trim() ?? firstLine;
    const title = firstLine.includes('|') ? firstLine.split('|')[1]?.trim() ?? firstLine : firstLine;

    // Try to find URL
    const urlMatch = text.match(/https?:\/\/[^\s<]+/);
    const url = urlMatch ? urlMatch[0] : '';

    // Try to find location
    const locationMatch = text.match(/(?:Location|Remote|Onsite|Hybrid)[:\s]*([^\n,]+)/i);
    const location = locationMatch?.[1]?.trim() ?? 'Remote';

    // Extract technologies from the text
    const techPatterns = ['javascript', 'typescript', 'python', 'java', 'go', 'golang', 'rust', 'c\\+\\+', 'ruby', 'php', 'swift', 'kotlin', 'react', 'vue', 'angular', 'node', 'django', 'rails', 'aws', 'gcp', 'azure', 'docker', 'kubernetes'];
    const technologies = techPatterns.filter((t) => new RegExp(`\\b${t}\\b`, 'i').test(text)).map((t) => t.replace(/\\\+/g, '+'));

    return { title, text, company, location, url, technologies };
  }
}

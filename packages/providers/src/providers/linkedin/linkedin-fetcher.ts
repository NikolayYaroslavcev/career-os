import { fetchWithTimeout } from '../../resilience/resilient-fetch.js';
import type { Fetcher, FetchResult } from '../../interfaces/fetcher.js';
import type { ProviderResult, ResultMeta } from '../../interfaces/result.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import type { SearchCriteria } from '../../interfaces/search-criteria.js';
import type { SyncCursor, CursorState } from '../../interfaces/sync-cursor.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { PROVIDER_METRICS } from '../../observability/metrics.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import type { LinkedInSearchParams } from './linkedin-types.js';

export interface LinkedInFetcherConfig {
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
  readonly rateLimitMs?: number;
}

const DEFAULT_BASE_URL = 'https://www.linkedin.com';
const DEFAULT_RATE_LIMIT_MS = 2000;
const MAX_START_OFFSET = 975;
const PAGE_SIZE = 25;

export class LinkedInFetcher implements Fetcher {
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;
  private readonly rateLimitMs: number;
  private lastRequestTime = 0;

  constructor(config: LinkedInFetcherConfig) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
    this.rateLimitMs = config.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('linkedin.fetcher.search', {
      providerId: 'linkedin',
      query: criteria.query ?? '',
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching LinkedIn jobs', {
        providerId: 'linkedin',
        operation: 'search',
        query: criteria.query,
        technologies: criteria.technologies,
      });

      const allJobs: RawJob[] = [];
      const seenIds = new Set<string>();
      let start = 0;
      let hasMore = true;
      const maxResults = criteria.limit ?? 200;

      while (hasMore && start <= MAX_START_OFFSET && allJobs.length < maxResults) {
        await this.enforceRateLimit();

        const params = this.buildSearchParams(criteria, start);
        const url = this.buildSearchUrl(params);

        const response = await fetchWithTimeout(url, { headers: this.buildHeaders() });

        if (!response.ok) {
          span.setAttribute('error', true);
          span.setAttribute('http.status', response.status);

          if (response.status === 429) {
            return {
              ok: false,
              error: ProviderErrorType.RATE_LIMITED,
              message: `HTTP ${response.status}: Rate limited by LinkedIn`,
              retryable: true,
              meta: { durationMs: Date.now() - startTime },
            };
          }

          if (response.status === 403) {
            return {
              ok: false,
              error: ProviderErrorType.PROVIDER_UNAVAILABLE,
              message: `HTTP ${response.status}: Access denied by LinkedIn`,
              retryable: true,
              meta: { durationMs: Date.now() - startTime },
            };
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const jobs = this.parseSearchResults(html);

        if (jobs.length === 0) {
          hasMore = false;
          break;
        }

        for (const job of jobs) {
          if (!seenIds.has(job.sourceId)) {
            seenIds.add(job.sourceId);
            allJobs.push(job);
          }
        }

        start += PAGE_SIZE;
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'linkedin',
        operation: 'search',
        status: 'success',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, {
        providerId: 'linkedin',
      });

      span.setAttribute('jobs.fetched', allJobs.length);
      span.setAttribute('duration_ms', durationMs);
      span.end();

      const meta: ResultMeta = {
        durationMs,
        providerMeta: { totalJobs: allJobs.length },
      };

      return { ok: true, data: allJobs, meta };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, {
        providerId: 'linkedin',
        operation: 'search',
        status: 'error',
      });
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, {
        providerId: 'linkedin',
      });

      span.setAttribute('error', true);
      span.end();

      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.startsWith('HTTP')) {
        return {
          ok: false,
          error: ProviderErrorType.NETWORK_ERROR,
          message,
          retryable: true,
          meta: { durationMs },
        };
      }

      return {
        ok: false,
        error: ProviderErrorType.UNKNOWN_ERROR,
        message,
        retryable: false,
        meta: { durationMs },
      };
    }
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const span = this.tracer.startSpan('linkedin.fetcher.getVacancy', {
      providerId: 'linkedin',
      sourceId,
    });

    const startTime = Date.now();

    try {
      this.logger.info('Fetching LinkedIn vacancy', {
        providerId: 'linkedin',
        operation: 'getVacancy',
        sourceId,
      });

      await this.enforceRateLimit();

      const url = `${this.baseUrl}/jobs/view/${sourceId}`;
      const response = await fetchWithTimeout(url, { headers: this.buildHeaders() });

      if (!response.ok) {
        if (response.status === 404) {
          span.setAttribute('found', false);
          span.end();
          return { ok: true, data: null, meta: { durationMs: Date.now() - startTime } };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const rawJob = this.parseDetailPage(html, sourceId);
      const durationMs = Date.now() - startTime;

      span.setAttribute('found', !!rawJob);
      span.end();

      return { ok: true, data: rawJob ?? null, meta: { durationMs } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      span.setAttribute('error', true);
      span.end();

      return {
        ok: false,
        error: ProviderErrorType.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        meta: { durationMs },
      };
    }
  }

  async fetchWithCursor(
    criteria: SearchCriteria,
    cursor: SyncCursor,
  ): Promise<ProviderResult<FetchResult>> {
    const span = this.tracer.startSpan('linkedin.fetcher.fetchWithCursor', {
      providerId: 'linkedin',
    });

    const startTime = Date.now();

    try {
      let start = 0;
      if (cursor.type === 'offset') {
        start = cursor.offset;
      } else if (cursor.type === 'page') {
        start = (cursor.page - 1) * (cursor.perPage || PAGE_SIZE);
      }

      await this.enforceRateLimit();

      const params = this.buildSearchParams(criteria, start);
      const url = this.buildSearchUrl(params);

      const response = await fetchWithTimeout(url, { headers: this.buildHeaders() });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const jobs = this.parseSearchResults(html);
      const durationMs = Date.now() - startTime;

      const newStart = start + PAGE_SIZE;
      const exhausted = jobs.length === 0 || newStart > MAX_START_OFFSET;

      const cursorState: CursorState = {
        cursor: {
          type: 'offset',
          offset: newStart,
          limit: PAGE_SIZE,
          totalResults: undefined,
        },
        strategy: 'offset',
        exhausted,
        fetchedCount: jobs.length,
      };

      const fetchResult: FetchResult = {
        jobs,
        cursor: cursorState,
        hasMore: !exhausted,
        meta: { totalJobs: jobs.length },
      };

      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return {
        ok: true,
        data: fetchResult,
        meta: { durationMs },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      span.setAttribute('error', true);
      span.end();

      return {
        ok: false,
        error: ProviderErrorType.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        meta: { durationMs },
      };
    }
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const span = this.tracer.startSpan('linkedin.fetcher.ping', {
      providerId: 'linkedin',
    });

    const startTime = Date.now();

    try {
      this.logger.debug('Pinging LinkedIn', {
        providerId: 'linkedin',
        operation: 'ping',
      });

      const response = await fetchWithTimeout(this.baseUrl, {
        method: 'HEAD',
        headers: this.buildHeaders(),
      });
      const durationMs = Date.now() - startTime;

      span.setAttribute('http.status', response.status);
      span.end();

      return { ok: true, data: response.ok, meta: { durationMs } };
    } catch {
      const durationMs = Date.now() - startTime;
      span.setAttribute('error', true);
      span.end();

      return {
        ok: false,
        error: ProviderErrorType.NETWORK_ERROR,
        message: 'Network error',
        retryable: true,
        meta: { durationMs },
      };
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitMs) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Cache-Control': 'no-cache',
    };
  }

  private buildSearchParams(criteria: SearchCriteria, start: number): LinkedInSearchParams {
    const params: LinkedInSearchParams = {};

    if (criteria.query) {
      params.keywords = criteria.query;
    } else if (criteria.technologies && criteria.technologies.length > 0) {
      params.keywords = criteria.technologies.join(' ');
    }

    if (criteria.location) {
      params.location = criteria.location;
    }

    params.start = start;
    params.sortBy = 'DD';

    if (criteria.remoteOnly) {
      params.f_WT = '2';
    }

    return params;
  }

  private buildSearchUrl(params: LinkedInSearchParams): string {
    const url = new URL(`${this.baseUrl}/jobs-guest/jobs/api/seeMoreJobPostings/search`);

    if (params.keywords) {
      url.searchParams.set('keywords', params.keywords);
    }
    if (params.location) {
      url.searchParams.set('location', params.location);
    }
    if (params.start !== undefined) {
      url.searchParams.set('start', String(params.start));
    }
    if (params.sortBy) {
      url.searchParams.set('sortBy', params.sortBy);
    }
    if (params.f_WT) {
      url.searchParams.set('f_WT', params.f_WT);
    }

    return url.toString();
  }

  private parseSearchResults(html: string): RawJob[] {
    const jobs: RawJob[] = [];
    const now = new Date();

    const cardRegex = /<li[^>]*class="[^"]*reusable-search__result-container[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let match;

    while ((match = cardRegex.exec(html)) !== null) {
      const cardHtml = match[1] ?? '';
      const job = this.parseCardHtml(cardHtml, now);
      if (job) {
        jobs.push(job);
      }
    }

    if (jobs.length === 0) {
      const fallbackRegex = /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]*)"[^>]*>/gi;
      while ((match = fallbackRegex.exec(html)) !== null) {
        const href = match[1] ?? '';
        if (!href) continue;
        const jobId = this.extractJobId(href);
        if (jobId) {
          const titleMatch = html.substring(match.index, match.index + 2000);
          const title = this.extractText(titleMatch, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
          const company = this.extractText(titleMatch, /<h4[^>]*class="[^"]*entity[^"]*"[^>]*>([\s\S]*?)<\/h4>/i);
          const location = this.extractText(titleMatch, /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
          const dateStr = this.extractAttr(titleMatch, 'time', 'datetime');

          if (title) {
            jobs.push(this.buildRawJob({
              jobId,
              title: this.cleanHtml(title),
              company: this.cleanHtml(company) || 'Unknown',
              location: this.cleanHtml(location) || '',
              url: href.startsWith('http') ? href : `https://www.linkedin.com${href}`,
              postedDate: dateStr,
            }, now));
          }
        }
      }
    }

    return jobs;
  }

  private parseCardHtml(cardHtml: string, now: Date): RawJob | null {
    const urlMatch = cardHtml.match(/<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]*)"[^>]*>/i);
    if (!urlMatch?.[1]) return null;

    const href = urlMatch[1];
    const url = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
    const jobId = this.extractJobId(url);
    if (!jobId) return null;

    const title = this.cleanHtml(this.extractText(cardHtml, /<h3[^>]*>([\s\S]*?)<\/h3>/i));
    const company = this.cleanHtml(this.extractText(cardHtml, /<h4[^>]*class="[^"]*entity[^"]*"[^>]*>([\s\S]*?)<\/h4>/i));
    const location = this.cleanHtml(this.extractText(cardHtml, /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i));
    const dateStr = this.extractAttr(cardHtml, 'time', 'datetime');
    const applicants = this.cleanHtml(this.extractText(cardHtml, /<span[^>]*class="[^"]*artdeco-entity-lockup__subtitle[^"]*"[^>]*>([\s\S]*?)<\/span>/i));

    if (!title) return null;

    return this.buildRawJob({
      jobId,
      title,
      company: company || 'Unknown',
      location: location || '',
      url,
      postedDate: dateStr,
      applicants,
    }, now);
  }

  private buildRawJob(data: {
    jobId: string;
    title: string;
    company: string;
    location: string;
    url: string;
    postedDate?: string;
    applicants?: string;
  }, now: Date): RawJob {
    const publishedAt = data.postedDate ? new Date(data.postedDate) : now;

    return {
      sourceId: data.jobId,
      title: data.title,
      description: '',
      companyName: data.company,
      location: data.location,
      technologies: [],
      url: data.url,
      publishedAt: isNaN(publishedAt.getTime()) ? now : publishedAt,
      fetchedAt: now,
      remote: false,
      extensions: {
        applicants: data.applicants,
        source: 'linkedin_guest_api',
      },
    };
  }

  private parseDetailPage(html: string, jobId: string): RawJob | null {
    const now = new Date();

    const title = this.cleanHtml(this.extractText(html, /<h1[^>]*class="[^"]*topcard__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i))
      || this.cleanHtml(this.extractText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));

    const company = this.cleanHtml(this.extractText(html, /<a[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i))
      || this.cleanHtml(this.extractText(html, /<span[^>]*class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>([\s\S]*?)<\/span>/i));

    const location = this.cleanHtml(this.extractText(html, /<span[^>]*class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>([\s\S]*?)<\/span>/i));

    const descriptionHtml = this.extractText(html, /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || '';
    const description = this.cleanHtml(descriptionHtml);

    const skills = this.extractSkills(html);

    if (!title) return null;

    return {
      sourceId: jobId,
      title,
      description,
      companyName: company || 'Unknown',
      location: location || '',
      technologies: skills,
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      publishedAt: now,
      fetchedAt: now,
      remote: false,
      extensions: {
        source: 'linkedin_guest_api',
        detailFetched: true,
      },
    };
  }

  private extractJobId(url: string): string | null {
    const match = url.match(/\/jobs\/view\/(\d+)/);
    return match?.[1] ?? null;
  }

  private extractText(html: string, regex: RegExp): string {
    const match = html.match(regex);
    return match?.[1] ?? '';
  }

  private extractAttr(html: string, tag: string, attr: string): string | undefined {
    const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
    const match = html.match(regex);
    return match ? match[1] : undefined;
  }

  private extractSkills(html: string): string[] {
    const skills: string[] = [];
    const skillRegex = /<span[^>]*class="[^"]*skill[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    let match;

    while ((match = skillRegex.exec(html)) !== null) {
      const skill = this.cleanHtml(match[1] ?? '');
      if (skill && skill.length > 0 && skill.length < 50) {
        skills.push(skill.toLowerCase());
      }
    }

    return [...new Set(skills)];
  }

  private cleanHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}

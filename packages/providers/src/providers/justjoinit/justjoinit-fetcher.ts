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

const SITEMAP_INDEX_URL = 'https://justjoin.it/sitemaps/active-jobs.xml';
const JOB_URL_PREFIX = 'https://justjoin.it/job-offer/';

// The active-jobs sitemap lists every currently-open posting (thousands) —
// fetching each one's full HTML page every sync tick doesn't scale, and
// freshness matters more than exhaustive backfill here (P1 priority #1).
// Bounding to the N most-recently-modified entries per tick means the first
// sync (cursor since=epoch) surfaces the newest postings immediately, and
// steady-state ticks only pay for what actually changed since last sync.
const MAX_JOBS_PER_SYNC = 100;

export interface SitemapEntry {
  readonly url: string;
  readonly lastmod: Date;
}

/** Parses a sitemap index (<sitemapindex>) into its child sitemap URLs. */
export function parseSitemapIndex(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => (m[1] ?? '').trim());
}

/** Parses a <urlset> sitemap into {url, lastmod} entries. */
export function parseSitemapEntries(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const block of blocks) {
    const loc = block.match(/<loc>([^<]*)<\/loc>/)?.[1]?.trim();
    const lastmodRaw = block.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1]?.trim();
    if (!loc || !lastmodRaw) continue;
    const lastmod = new Date(lastmodRaw);
    if (Number.isNaN(lastmod.getTime())) continue;
    entries.push({ url: loc, lastmod });
  }
  return entries;
}

export interface JobPostingJsonLd {
  readonly title?: string;
  readonly description?: string;
  readonly datePosted?: string;
  readonly employmentType?: string;
  readonly jobLocationType?: string;
  readonly hiringOrganization?: { readonly name?: string; readonly sameAs?: string };
  readonly jobLocation?: { readonly address?: { readonly addressLocality?: string; readonly addressCountry?: string } };
  readonly baseSalary?: {
    readonly currency?: string;
    readonly value?: { readonly minValue?: number; readonly maxValue?: number };
  };
}

/** Extracts the schema.org JobPosting JSON-LD block from a job-offer page, if present. */
export function parseJobPostingJsonLd(html: string): JobPostingJsonLd | null {
  const scripts = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1] ?? '') as JobPostingJsonLd & { '@type'?: string };
      if (parsed['@type'] === 'JobPosting') return parsed;
    } catch {
      // not valid JSON, or not this block — keep scanning
    }
  }
  return null;
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: 'full_time',
  PART_TIME: 'part_time',
  CONTRACTOR: 'contract',
  TEMPORARY: 'contract',
  INTERN: 'internship',
  VOLUNTEER: 'freelance',
};

/** Extracts the URL slug JustJoin.it uses as its stable per-job identifier. */
export function extractSourceId(jobUrl: string): string {
  return jobUrl.replace(/\/$/, '').split('/').pop() ?? jobUrl;
}

function jsonLdToRawJob(sourceId: string, url: string, jsonLd: JobPostingJsonLd, fetchedAt: Date): RawJob | null {
  const title = jsonLd.title?.trim();
  const companyName = jsonLd.hiringOrganization?.name?.trim();
  if (!title || !companyName) return null;

  const city = jsonLd.jobLocation?.address?.addressLocality?.trim();
  const country = jsonLd.jobLocation?.address?.addressCountry?.trim() || 'Poland';
  const location = city ? `${city}, ${country}` : country;

  const publishedAt = jsonLd.datePosted ? new Date(jsonLd.datePosted) : fetchedAt;

  const salaryValue = jsonLd.baseSalary?.value;
  const salary = salaryValue && (salaryValue.minValue !== undefined || salaryValue.maxValue !== undefined)
    ? { from: salaryValue.minValue, to: salaryValue.maxValue, currency: jsonLd.baseSalary?.currency ?? 'PLN', period: 'monthly' as const }
    : undefined;

  return {
    sourceId,
    title,
    description: jsonLd.description ?? '',
    companyName,
    companyUrl: jsonLd.hiringOrganization?.sameAs,
    location,
    salary,
    technologies: [],
    url,
    publishedAt: Number.isNaN(publishedAt.getTime()) ? fetchedAt : publishedAt,
    remote: jsonLd.jobLocationType === 'TELECOMMUTE',
    employmentType: jsonLd.employmentType ? EMPLOYMENT_TYPE_MAP[jsonLd.employmentType] : undefined,
    fetchedAt,
  };
}

export interface JustJoinItFetcherConfig {
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class JustJoinItFetcher implements Fetcher {
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: JustJoinItFetcherConfig) {
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const result = await this.fetchWithCursor({}, { type: 'timestamp', since: new Date(0), inclusive: false });
    if (!result.ok) return result;
    return { ok: true, data: [...result.data.jobs], meta: result.meta };
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const url = `${JOB_URL_PREFIX}${sourceId}`;
    try {
      const job = await this.fetchJob(url);
      return { ok: true, data: job, meta: { durationMs: 0 } };
    } catch (error) {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: error instanceof Error ? error.message : 'Unknown error', retryable: true, meta: { durationMs: 0 } };
    }
  }

  async fetchWithCursor(_criteria: SearchCriteria, cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    const span = this.tracer.startSpan('justjoinit.fetcher.fetchWithCursor', { providerId: 'justjoin_it' });
    const startTime = Date.now();
    const since = cursor.type === 'timestamp' ? cursor.since : new Date(0);

    try {
      const indexResponse = await resilientFetch(SITEMAP_INDEX_URL, 'justjoin_it');
      if (!indexResponse.ok) throw new Error(`HTTP ${indexResponse.status}: ${indexResponse.statusText}`);
      const partUrls = parseSitemapIndex(await indexResponse.text());

      const allEntries: SitemapEntry[] = [];
      for (const partUrl of partUrls) {
        const partResponse = await resilientFetch(partUrl, 'justjoin_it');
        if (!partResponse.ok) continue;
        allEntries.push(...parseSitemapEntries(await partResponse.text()));
      }

      const fresh = allEntries
        .filter((e) => e.lastmod > since)
        .sort((a, b) => b.lastmod.getTime() - a.lastmod.getTime());
      const selected = fresh.slice(0, MAX_JOBS_PER_SYNC);

      const jobs: RawJob[] = [];
      for (const entry of selected) {
        try {
          const job = await this.fetchJob(entry.url);
          if (job) jobs.push(job);
        } catch (error) {
          this.logger.warn('Failed to fetch JustJoin.it job page, skipping', { providerId: 'justjoin_it', url: entry.url, error: error instanceof Error ? error.message : String(error) });
        }
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'justjoin_it', status: 'success' });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'justjoin_it' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.setAttribute('jobs.matched', fresh.length);
      span.end();

      const cursorState: CursorState = {
        cursor: { type: 'timestamp', since: new Date(), inclusive: false },
        strategy: 'timestamp',
        exhausted: fresh.length <= MAX_JOBS_PER_SYNC,
        fetchedCount: jobs.length,
      };

      return {
        ok: true,
        data: { jobs, cursor: cursorState, hasMore: fresh.length > MAX_JOBS_PER_SYNC, meta: { totalMatched: fresh.length, totalActive: allEntries.length } },
        meta: { durationMs },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'justjoin_it' });
      span.setAttribute('error', true);
      span.end();
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: message.startsWith('HTTP') ? ProviderErrorType.NETWORK_ERROR : ProviderErrorType.UNKNOWN_ERROR, message, retryable: true, meta: { durationMs } };
    }
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const startTime = Date.now();
    try {
      const response = await resilientFetch(SITEMAP_INDEX_URL, 'justjoin_it', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private async fetchJob(url: string): Promise<RawJob | null> {
    const response = await resilientFetch(url, 'justjoin_it');
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const html = await response.text();
    const jsonLd = parseJobPostingJsonLd(html);
    if (!jsonLd) return null;
    return jsonLdToRawJob(extractSourceId(url), url, jsonLd, new Date());
  }
}

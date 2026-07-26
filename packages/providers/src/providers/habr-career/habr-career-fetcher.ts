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

export interface HabrCareerFetcherConfig {
  readonly baseUrl: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

// Keyword bank for best-effort technology extraction from title+description —
// the RSS feed carries no structured skills field. Mirrors the same
// keyword-scan approach hh-fetcher.ts uses for HH's list endpoint.
const TECH_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'golang', 'rust',
  '1c', '1с', 'php', 'ruby', 'scala', 'kotlin', 'swift', 'dart', 'flutter',
  'react', 'vue', 'angular', 'node', 'node.js', 'nodejs', 'express', 'django', 'flask', 'spring', 'laravel',
  'nextjs', 'next.js', 'nuxtjs', 'svelte',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'clickhouse', 'kafka',
  'git', 'ci/cd', 'jenkins', 'gitlab', 'github actions',
  'html', 'css', 'scss', 'less', 'tailwind',
  'sql', 'nosql', 'graphql', 'rest', 'grpc',
  'linux', 'bash', 'powershell',
  'machine learning', 'ml', 'ai', 'data science', 'pandas', 'pytorch', 'tensorflow',
  'android', 'ios',
  'figma', 'sketch',
];

// Known CIS city names for best-effort location extraction from free-text
// description — the RSS feed has no structured location field either.
const CIS_CITIES = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород',
  'Минск', 'Гомель', 'Витебск',
  'Алматы', 'Астана', 'Нур-Султан', 'Караганда', 'Шымкент',
  'Ташкент', 'Самарканд',
  'Бишкек', 'Ош',
  'Баку', 'Гянджа',
  'Ереван', 'Тбилиси', 'Кишинёв', 'Кишинев',
];

const REMOTE_MARKERS = ['удалённо', 'удаленно', 'удалённая работа', 'удаленная работа', 'remote'];

const SALARY_PATTERN =
  /(\d[\d\s]{2,})\s*(?:–|-|—)\s*(\d[\d\s]{2,})?\s*(₽|руб\.?|рублей|USD|\$|EUR|€)/iu;

export class HabrCareerFetcher implements Fetcher {
  constructor(private readonly config: HabrCareerFetcherConfig) {}

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('habr_career.fetcher.search', { providerId: 'habr_career' });
    const startTime = Date.now();

    try {
      this.config.logger.info('Fetching Habr Career jobs', { providerId: 'habr_career', operation: 'search' });

      const response = await resilientFetch(this.config.baseUrl, 'habr_career');
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const xml = await response.text();
      const jobs = this.parseRss(xml);

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'habr_career', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'habr_career' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'habr_career' });
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
    return {
      ok: true,
      data: {
        jobs: result.data,
        cursor: { cursor: { type: 'none', message: 'Returns all jobs' }, strategy: 'none', exhausted: true, fetchedCount: result.data.length },
        hasMore: false,
        meta: { totalJobs: result.data.length },
      },
      meta: result.meta,
    };
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const startTime = Date.now();
    try {
      const response = await resilientFetch(this.config.baseUrl, 'habr_career', { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private parseRss(xml: string): RawJob[] {
    const now = new Date();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

    return items.map((item, idx) => {
      const rawTitle = this.extractTag(item, 'title')?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? '';
      const link = this.extractTag(item, 'link')?.trim() ?? '';
      const guid = this.extractTag(item, 'guid')?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? '';
      const rawDescription = this.extractTag(item, 'description')?.replace(/<!\[CDATA\[|\]\]>/g, '') ?? '';
      const description = rawDescription.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const pubDate = this.extractTag(item, 'pubDate')?.trim() ?? '';
      const category = this.extractTag(item, 'category')?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? '';

      const { title, companyName } = this.splitTitleAndCompany(rawTitle);
      const combinedText = `${title} ${description}`;

      return {
        sourceId: this.extractSourceId(link, guid, idx),
        title,
        description,
        companyName,
        location: this.extractLocation(combinedText),
        salary: this.extractSalary(description),
        technologies: this.extractTechnologies(combinedText, category),
        url: link || guid,
        publishedAt: pubDate ? new Date(pubDate) : now,
        remote: this.isRemote(combinedText),
        fetchedAt: now,
      };
    });
  }

  /**
   * Habr Career vacancy RSS titles commonly follow "Job Title (Company Name)".
   * When that trailing parenthetical is absent the title is left as-is and
   * companyName falls back to 'Unknown' — the RSS feed has no dedicated
   * company field, same limitation NoDeskFetcher already documents for its
   * own feed.
   */
  private splitTitleAndCompany(rawTitle: string): { title: string; companyName: string } {
    const match = rawTitle.match(/^(.*)\(([^()]+)\)\s*$/);
    if (match) {
      const title = match[1]!.trim();
      const companyName = match[2]!.trim();
      if (title && companyName) {
        return { title, companyName };
      }
    }
    return { title: rawTitle, companyName: 'Unknown' };
  }

  private extractSourceId(link: string, guid: string, idx: number): string {
    const source = link || guid;
    const match = source.match(/\/vacancies\/([a-z0-9]+)/i);
    if (match) return match[1]!;
    return guid || link || `habr-career-${idx}`;
  }

  private extractLocation(text: string): string {
    for (const city of CIS_CITIES) {
      if (text.includes(city)) {
        return city;
      }
    }
    if (this.isRemote(text)) {
      return 'Удалённо';
    }
    return 'Не указано';
  }

  private isRemote(text: string): boolean {
    const lower = text.toLowerCase();
    return REMOTE_MARKERS.some((marker) => lower.includes(marker));
  }

  private extractSalary(description: string): RawJob['salary'] | undefined {
    const match = description.match(SALARY_PATTERN);
    if (!match) return undefined;

    const from = Number(match[1]!.replace(/\s/g, ''));
    const to = match[2] ? Number(match[2].replace(/\s/g, '')) : undefined;
    const currencyToken = match[3]!.toLowerCase();
    const currency = currencyToken.includes('₽') || currencyToken.startsWith('руб') ? 'RUB'
      : currencyToken === '$' || currencyToken.startsWith('usd') ? 'USD'
      : currencyToken === '€' || currencyToken.startsWith('eur') ? 'EUR'
      : currencyToken.toUpperCase();

    if (!from && !to) return undefined;

    return { from: from || undefined, to, currency, period: 'monthly' };
  }

  private extractTechnologies(text: string, category: string): string[] {
    const lower = text.toLowerCase();
    const found = TECH_KEYWORDS.filter((tech) => lower.includes(tech));
    const fromCategory = category
      ? category.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
      : [];
    return [...new Set([...found, ...fromCategory])];
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match?.[1]?.trim() ?? null;
  }
}

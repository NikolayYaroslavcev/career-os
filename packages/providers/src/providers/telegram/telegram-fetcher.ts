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
import type { TelegramRawMessage } from './telegram-types.js';

export interface TelegramFetcherConfig {
  readonly channels: readonly string[];
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
  /** Dynamic channel provider. Called at the start of each search to get
   *  the current enabled channels from the database. When provided, the
   *  static `channels` array is used only as fallback. */
  readonly channelProvider?: () => Promise<readonly string[]>;
}

// Same keyword-bank approach as habr-career-fetcher.ts/hh-fetcher.ts — job
// channel posts carry no structured skills field, so technologies are
// best-effort keyword-scanned out of the free text.
const TECH_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'go', 'rust',
  '1c', '1с', 'php', 'ruby', 'scala', 'kotlin', 'swift', 'dart', 'flutter',
  'react', 'vue', 'angular', 'node', 'node.js', 'nodejs', 'express', 'django', 'flask', 'spring', 'laravel',
  'nextjs', 'next.js', 'nuxtjs', 'svelte', 'unity',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'clickhouse', 'kafka',
  'git', 'ci/cd', 'jenkins', 'gitlab', 'github actions',
  'html', 'css', 'scss', 'less', 'tailwind',
  'sql', 'nosql', 'graphql', 'rest', 'grpc',
  'linux', 'bash', 'powershell',
  'machine learning', 'ml', 'ai', 'data science', 'pandas', 'pytorch', 'tensorflow',
  'android', 'ios', 'unreal',
  'figma', 'sketch', 'qa', 'devops',
];

// Signals that a post is a vacancy at all (as opposed to channel chatter,
// service messages, or an unrelated announcement) — required since a public
// channel's preview page has no "this is a job" flag to key off of.
const VACANCY_KEYWORDS = [
  'vacancy', 'vacancies', 'hiring', 'we are looking', "we're looking", 'job opening', 'position',
  'developer', 'engineer', 'designer', 'manager', 'analyst', 'tester', 'architect', 'fulltime', 'parttime',
  'вакансия', 'вакансии', 'ищем', 'требуется', 'требуются', 'набираем', 'разработчик', 'программист',
  'инженер', 'дизайнер', 'менеджер', 'аналитик', 'тестировщик', 'архитектор', 'откликнуться', 'резюме',
];

const CIS_CITIES = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород',
  'Минск', 'Гомель', 'Витебск',
  'Алматы', 'Астана', 'Нур-Султан', 'Караганда', 'Шымкент',
  'Ташкент', 'Самарканд',
  'Бишкек', 'Ош',
  'Баку', 'Гянджа',
  'Ереван', 'Тбилиси', 'Кишинёв', 'Кишинев',
];

const REMOTE_MARKERS = ['удалённо', 'удаленно', 'удалённая работа', 'удаленная работа', 'remote', 'из дома', 'дистанцион'];

const APPLY_KEYWORDS = ['apply', 'откликнуться', 'отклик', 'resume', 'cv', 'резюме', 'подать заявку', 'send your', 'job description', 'описание вакансии', 'вакансия на'];

// A salary figure: grouped-thousands digits ("200 000") or a `k`-suffixed
// number that may carry a decimal comma/dot ("2,8k", "3.5k") — the comma
// branch must be tried before the plain-digit branch, otherwise "2,8k" only
// matches its "8k" tail and silently turns €2,800 into €8,000.
const SALARY_NUMBER = String.raw`\d+(?:[.,]\d+)?\s*k|\d[\d\s]{2,}`;

// Matches "100 000 - 150 000 RUB", "от 180000 до 250000 руб.", "$3000-4000",
// "150k-200k USD", "€2,8k – €3k" — a salary number range with an explicit
// currency token (can be before or after the numbers).
const SALARY_PATTERN = new RegExp(
  String.raw`(${SALARY_NUMBER})\s*(?:–|-|—|to|до)\s*(${SALARY_NUMBER})?\s*(₽|руб\.?|рублей|rub|usd|\$|eur|€|kzt|тенге|тг)|(₽|руб\.?|рублей|rub|usd|\$|eur|€|kzt|тенге|тг)\s*(${SALARY_NUMBER})\s*(?:–|-|—|to|до)\s*(${SALARY_NUMBER})?`,
  'iu',
);

// CIS channels routinely quote a bare thousands figure with no currency token
// at all ("30К — 50К", "До 35К на старте") — always rubles by convention on
// these channels, unlike the explicit-currency ranges SALARY_PATTERN handles.
// Restricted to 2-3 digit figures before the thousand marker to keep this
// from matching unrelated numbers that happen to precede a capital К.
const IMPLICIT_RUB_SALARY_PATTERN =
  /(\d{2,3}(?:[.,]\d+)?)\s*[кК]\s*(?:–|-|—|до)\s*(\d{2,3}(?:[.,]\d+)?)\s*[кК]|до\s+(\d{2,3}(?:[.,]\d+)?)\s*[кК]/u;

// Single salary with currency: "$3000", "€5000", "₽200 000", "180000 тг"
const SINGLE_SALARY_PATTERN = new RegExp(
  String.raw`(₽|руб\.?|рублей|rub|usd|\$|eur|€|kzt|тенге|тг)\s*(${SALARY_NUMBER})|(${SALARY_NUMBER})\s*(₽|руб\.?|рублей|rub|usd|\$|eur|€|kzt|тенге|тг)`,
  'iu',
);

// Salary with "от" (from) prefix: "от 200к", "от 180 000"
const FROM_SALARY_PATTERN = new RegExp(
  String.raw`от\s+(${SALARY_NUMBER})\s*(₽|руб\.?|рублей|rub|usd|\$|eur|€|kzt|тенге|тг|[кК])`,
  'iu',
);

// Salary with "тыс" (thousands) suffix: "200-300 тыс", "150 тыс"
const TYST_SALARY_PATTERN = /(\d{2,3})\s*(?:–|-|—)\s*(\d{2,3})\s*тыс|(\d{2,3})\s*тыс/u;

// HTML-encoded currency symbols
const HTML_CURRENCY_PATTERN = /&#036;|&#8381;|&#8364;/g;

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const TELEGRAM_USERNAME_PATTERN = /(?<![\w/@])@([A-Za-z]\w{4,31})/g;
const TME_USERNAME_LINK_PATTERN = /^https?:\/\/t\.me\/([A-Za-z]\w{4,31})\/?$/i;

interface ExtractedContacts {
  readonly applyUrl?: string;
  readonly emails: readonly string[];
  readonly telegramUsernames: readonly string[];
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(HTML_CURRENCY_PATTERN, (m) => (m === '&#036;' ? '$' : m === '&#8381;' ? '₽' : '€'))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

function extractLinksWithText(html: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const regex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    links.push({ href: match[1]!, text: htmlToText(match[2]!) });
  }
  return links;
}

function parseSalaryNumber(raw: string): number {
  const trimmed = raw.trim().toLowerCase().replace(',', '.');
  if (trimmed.endsWith('k')) {
    return Math.round(parseFloat(trimmed) * 1000);
  }
  return Number(trimmed.replace(/\s/g, ''));
}

function mapCurrency(token: string): string {
  const t = token.toLowerCase();
  if (t.includes('₽') || t.startsWith('руб')) return 'RUB';
  if (t === 'rub') return 'RUB';
  if (t === '$' || t.startsWith('usd') || t.includes('&#036;')) return 'USD';
  if (t === '€' || t.startsWith('eur') || t.includes('&#8364;')) return 'EUR';
  if (t.includes('тенге') || t === 'kzt' || t === 'тг') return 'KZT';
  return token.toUpperCase();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#036;/g, '$')
    .replace(/&#8381;/g, '₽')
    .replace(/&#8364;/g, '€')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export class TelegramFetcher implements Fetcher {
  private readonly channels: readonly string[];
  private readonly channelProvider?: () => Promise<readonly string[]>;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: TelegramFetcherConfig) {
    this.channels = config.channels;
    this.channelProvider = config.channelProvider;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  private async resolveChannels(): Promise<readonly string[]> {
    if (this.channelProvider) {
      try {
        const dynamic = await this.channelProvider();
        if (dynamic.length > 0) return dynamic;
      } catch (error) {
        this.logger.warn('Dynamic channel provider failed, falling back to static channels', {
          providerId: 'telegram',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return this.channels;
  }

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('telegram.fetcher.search', { providerId: 'telegram' });
    const startTime = Date.now();

    try {
      const channels = await this.resolveChannels();

      this.logger.info('Fetching Telegram channel vacancies', {
        providerId: 'telegram',
        operation: 'search',
        channels: channels.join(','),
      });

      const allJobs: RawJob[] = [];

      for (const channel of channels) {
        try {
          const messages = await this.fetchChannelMessages(channel);
          for (const msg of messages) {
            const job = this.buildRawJob(msg);
            if (job) allJobs.push(job);
          }
        } catch (channelError) {
          this.logger.warn('Telegram channel fetch failed', {
            providerId: 'telegram',
            channel,
            error: channelError instanceof Error ? channelError.message : String(channelError),
          });
        }
      }

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'telegram', status: 'success' });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, allJobs.length, { providerId: 'telegram' });
      span.setAttribute('jobs.fetched', allJobs.length);
      span.end();

      return { ok: true, data: allJobs, meta: { durationMs, providerMeta: { totalJobs: allJobs.length, channels: channels.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'telegram' });
      span.setAttribute('error', true);
      span.end();
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: ProviderErrorType.UNKNOWN_ERROR, message, retryable: true, meta: { durationMs } };
    }
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const startTime = Date.now();
    const separator = sourceId.indexOf(':');
    const channel = separator === -1 ? undefined : sourceId.slice(0, separator);

    if (!channel) {
      return { ok: true, data: null, meta: { durationMs: Date.now() - startTime } };
    }

    const channels = await this.resolveChannels();
    if (!channels.includes(channel)) {
      return { ok: true, data: null, meta: { durationMs: Date.now() - startTime } };
    }

    try {
      const messages = await this.fetchChannelMessages(channel);
      const match = messages.find((m) => `${m.channel}:${m.messageId}` === sourceId);
      const job = match ? this.buildRawJob(match, { skipClassification: true }) : null;
      return { ok: true, data: job, meta: { durationMs: Date.now() - startTime } };
    } catch (error) {
      return {
        ok: false,
        error: ProviderErrorType.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        meta: { durationMs: Date.now() - startTime },
      };
    }
  }

  async fetchWithCursor(criteria: SearchCriteria, _cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    const result = await this.search(criteria);
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        jobs: result.data,
        cursor: {
          cursor: { type: 'none', message: 'Returns the current preview window (~20 most recent posts) per channel' },
          strategy: 'none',
          exhausted: true,
          fetchedCount: result.data.length,
        },
        hasMore: false,
        meta: { totalJobs: result.data.length },
      },
      meta: result.meta,
    };
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const startTime = Date.now();
    const channels = await this.resolveChannels();
    const channel = channels[0];
    if (!channel) {
      return { ok: true, data: false, meta: { durationMs: Date.now() - startTime } };
    }

    try {
      const response = await resilientFetch(`https://t.me/s/${channel}`, `telegram:${channel}`, { timeoutMs: 5000, maxRetries: 1 });
      return { ok: true, data: response.ok, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private async fetchChannelMessages(channel: string): Promise<TelegramRawMessage[]> {
    const url = `https://t.me/s/${channel}`;
    const response = await resilientFetch(url, `telegram:${channel}`, { timeoutMs: 15000, maxRetries: 2 });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const messages = this.parseChannelHtml(html, channel);

    // A 200 response with zero parseable messages usually means the channel
    // doesn't expose the `/s/` preview at all (Telegram silently redirects
    // some channels to the app-landing page instead of a 404) rather than
    // the channel being genuinely empty — worth a warning either way.
    if (messages.length === 0) {
      this.logger.warn('Telegram channel produced no parseable messages', { providerId: 'telegram', channel, responseUrl: response.url });
    }

    return messages;
  }

  private parseChannelHtml(html: string, channel: string): TelegramRawMessage[] {
    const marker = '<div class="tgme_widget_message_wrap';
    const starts: number[] = [];
    let idx = html.indexOf(marker);
    while (idx !== -1) {
      starts.push(idx);
      idx = html.indexOf(marker, idx + marker.length);
    }

    const messages: TelegramRawMessage[] = [];
    for (let i = 0; i < starts.length; i++) {
      const chunk = html.slice(starts[i]!, starts[i + 1] ?? html.length);
      const parsed = this.parseMessageChunk(chunk, channel);
      if (parsed) messages.push(parsed);
    }
    return messages;
  }

  private parseMessageChunk(chunk: string, channel: string): TelegramRawMessage | null {
    const postMatch = chunk.match(/data-post="([^"/]+)\/(\d+)"/);
    if (!postMatch) return null;

    const messageId = postMatch[2]!;
    const timeMatch = chunk.match(/<time datetime="([^"]+)"/);
    const publishedAt = timeMatch ? new Date(timeMatch[1]!) : new Date();
    const textMatch = chunk.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const textHtml = textMatch?.[1] ?? '';
    // The outer `tgme_widget_message_wrap` div is never the service-message
    // marker — it's the next sibling div (`class="tgme_widget_message
    // ... service_message ..."`) that carries it, so match specifically on
    // that class attribute rather than scanning the whole chunk (which could
    // false-positive on the literal words appearing inside message text).
    const messageClassMatch = chunk.match(/<div class="(tgme_widget_message\b[^"]*)"/);
    const isServiceMessage = messageClassMatch?.[1]?.includes('service_message') ?? false;

    return {
      channel,
      messageId,
      textHtml,
      text: htmlToText(textHtml),
      publishedAt,
      links: extractLinksWithText(textHtml).map((l) => l.href),
      isServiceMessage,
    };
  }

  private isLikelyVacancyPost(msg: TelegramRawMessage): boolean {
    if (msg.isServiceMessage) return false;
    if (!msg.text || msg.text.trim().length < 15) return false;

    const lower = msg.text.toLowerCase();
    const hasVacancyKeyword = VACANCY_KEYWORDS.some((k) => lower.includes(k));
    const hasTechKeyword = TECH_KEYWORDS.some((k) => lower.includes(k));
    return hasVacancyKeyword || hasTechKeyword;
  }

  private buildRawJob(msg: TelegramRawMessage, options: { skipClassification?: boolean } = {}): RawJob | null {
    if (!options.skipClassification && !this.isLikelyVacancyPost(msg)) {
      return null;
    }

    const { title, companyName, location: labeledLocation } = this.extractTitleCompanyLocation(msg.text);
    const remote = this.isRemote(msg.text);
    const location = labeledLocation || this.extractLocationFromText(msg.text) || (remote ? 'Удалённо' : 'Не указано');
    const salary = this.extractSalary(msg.text);
    const technologies = this.extractTechnologies(msg.text);
    const contacts = this.extractContacts(msg);
    const postUrl = `https://t.me/${msg.channel}/${msg.messageId}`;

    // Find the best apply URL: prefer external links, fall back to source URL in text
    const sourceUrlFromText = this.extractSourceUrlFromText(msg.text);
    const applyUrl = contacts.applyUrl ?? sourceUrlFromText ?? postUrl;

    return {
      sourceId: `${msg.channel}:${msg.messageId}`,
      title: this.normalizeTitleCase(title || 'Untitled vacancy'),
      description: msg.text,
      companyName,
      location,
      salary,
      technologies,
      url: applyUrl,
      publishedAt: msg.publishedAt,
      fetchedAt: new Date(),
      remote,
      extensions: {
        channel: msg.channel,
        postUrl,
        sourceUrl: sourceUrlFromText,
        emails: contacts.emails,
        telegramUsernames: contacts.telegramUsernames,
      },
    };
  }

  private extractTitleCompanyLocation(text: string): { title: string; companyName: string; location: string } {
    const firstLine = text.split('\n')[0]?.trim() ?? '';

    // "TITLE | LOCATION | COMPANY" convention some channels use (e.g. remoteit).
    const pipeParts = firstLine.split('|').map((p) => p.trim()).filter(Boolean);
    if (pipeParts.length >= 3) {
      return {
        title: this.cleanTitle(pipeParts[0]!),
        location: pipeParts[1]!,
        companyName: this.cleanTitle(pipeParts[pipeParts.length - 1]!),
      };
    }
    // "TITLE | LOCATION" with no company segment (same channels, posts that
    // omit the company). Still worth splitting on the pipe — otherwise the
    // trailing hashtags/URL that belong to the location segment leak into
    // the title as one unclean blob (e.g. "TITLE | LOCATION #tag1 #tag2").
    if (pipeParts.length === 2) {
      return {
        title: this.cleanTitle(pipeParts[0]!),
        location: this.cleanTitle(pipeParts[1]!),
        companyName: this.extractViaCompany(text) ?? this.extractCompanyFromLabels(text) ?? 'Unknown',
      };
    }

    const companyLabelMatch = text.match(/(?:company|компания|работодатель)\s*[:\-–]\s*(.+)/iu);
    const titleLabelMatch = text.match(/(?:position|vacancy|title|должность|вакансия)\s*[:\-–]\s*(.+)/iu);
    const locationLabelMatch = text.match(/(?:location|город|локация)\s*[:\-–]\s*(.+)/iu);

    return {
      title: this.cleanTitle(titleLabelMatch?.[1] ?? firstLine),
      companyName: companyLabelMatch?.[1]?.split('\n')[0]?.trim() || this.extractViaCompany(text) || this.extractCompanyFromLabels(text) || 'Unknown',
      location: locationLabelMatch?.[1]?.split('\n')[0]?.trim() ?? '',
    };
  }

  // "<Title>\nв <Company> — description" is the dominant convention on
  // CIS job-repost channels (e.g. jobforjunior) once the title's own line is
  // peeled off — there's no label at all, just this "в X — " lead-in before
  // free-text company description. Anchored to the start of a line (not just
  // anywhere "в" appears) to avoid matching the word mid-sentence.
  private extractViaCompany(text: string): string | undefined {
    // Match "в Company —" or "в Company -" with em dash, en dash, or hyphen
    const match = text.match(/(?:^|\n)\s*в\s+(.+?)\s*[—–-]\s/mu);
    return match?.[1]?.trim() || undefined;
  }

  // Extract company from labeled formats: "Компания: XYZ", "Company: XYZ"
  // Some channels (workitkz, job_python) use this format
  private extractCompanyFromLabels(text: string): string | undefined {
    const match = text.match(/(?:компания|company|работодатель|employer)\s*[:\-–]\s*(.+?)(?:\n|$)/iu);
    if (match) {
      // Clean up the company name - remove URLs and extra whitespace
      return match[1]!
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
    }
    return undefined;
  }

  // Extract source URL from text (e.g., teletype.in, linkedin.com, company career pages)
  // Many channels include the apply URL directly in the message text
  private extractSourceUrlFromText(text: string): string | undefined {
    // Match common career/job board URLs
    const urlPatterns = [
      /https?:\/\/(?:www\.)?linkedin\.com\/jobs\/view\/[^\s<]+/i,
      /https?:\/\/(?:www\.)?hh\.ru\/vacancy\/\d+/i,
      /https?:\/\/teletype\.in\/@[^\s<]+/i,
      /https?:\/\/[^\s<]*(?:career|vacancy|jobs|apply|join)[^\s<]*/i,
    ];

    for (const pattern of urlPatterns) {
      const match = text.match(pattern);
      if (match) {
        return decodeHtmlEntities(match[0]);
      }
    }

    // Fall back to any external URL that looks like a job posting
    const generalUrl = text.match(/https?:\/\/[^\s<]+/);
    if (generalUrl) {
      const url = decodeHtmlEntities(generalUrl[0]);
      // Exclude Telegram links and image/media URLs
      if (!url.includes('t.me/') && !url.match(/\.(jpg|jpeg|png|gif|webp|mp4)$/i)) {
        return url;
      }
    }

    return undefined;
  }

  // Normalize ALL CAPS titles to Title Case for better readability
  private normalizeTitleCase(title: string): string {
    // Only normalize if the title is mostly uppercase (more than 70% uppercase letters)
    const letters = title.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
    const uppercaseLetters = title.replace(/[^A-ZА-ЯЁ]/g, '');
    if (letters.length > 5 && uppercaseLetters.length / letters.length > 0.7) {
      // Convert to title case, preserving common abbreviations
      return title
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
        // Preserve common tech abbreviations
        .replace(/\b(C\+\+|C#|\.Net|Node\.js|React\.js|Vue\.js)\b/gi, (match) => match.toUpperCase())
        // Fix specific patterns
        .replace(/Qa/g, 'QA')
        .replace(/Devops/g, 'DevOps')
        .replace(/Sre/g, 'SRE')
        .replace(/Ml/g, 'ML')
        .replace(/Ai/g, 'AI')
        .replace(/It/g, 'IT')
        .replace(/Hr/g, 'HR')
        .replace(/Cv/g, 'CV');
    }
    return title;
  }

  private cleanTitle(raw: string): string {
    // Hashtags (and the URL/connector words trailing them, e.g. Telegram's
    // own "#remote or #relocation" separator) are always tacked on at the
    // end of the real content in this channel format, so truncating at the
    // first one is more reliable than stripping tokens individually — that
    // approach left dangling connector words like "NEXTERS or" behind.
    // `#\S+` (not a bare `#`) never matches inside "C#" — nothing but
    // whitespace follows that `#` — so this is safe for tech-in-title cases.
    const hashtagIndex = raw.search(/#\S+/);
    const withoutTrailingHashtags = hashtagIndex === -1 ? raw : raw.slice(0, hashtagIndex);
    return withoutTrailingHashtags
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+or$/i, '') // Remove trailing "or" from titles like "REMOTE OR RELOCATION or"
      .trim()
      .slice(0, 200);
  }

  private extractLocationFromText(text: string): string {
    for (const city of CIS_CITIES) {
      if (text.includes(city)) return city;
    }
    return '';
  }

  private isRemote(text: string): boolean {
    const lower = text.toLowerCase();
    return REMOTE_MARKERS.some((marker) => lower.includes(marker));
  }

  private extractSalary(text: string): RawJob['salary'] | undefined {
    // Decode HTML entities first (e.g., &#036; -> $)
    const decoded = decodeHtmlEntities(text);

    // Try range with explicit currency: "100 000 - 150 000 RUB", "$3000-4000"
    const rangeMatch = decoded.match(SALARY_PATTERN);
    if (rangeMatch) {
      // Pattern can match two formats:
      // 1. number range + currency: groups 1,2,3
      // 2. currency + number range: groups 4,5,6
      const fromStr = rangeMatch[1] || rangeMatch[5];
      const toStr = rangeMatch[2] || rangeMatch[6];
      const currencyToken = rangeMatch[3] || rangeMatch[4];

      if (fromStr && currencyToken) {
        const from = parseSalaryNumber(fromStr);
        const to = toStr ? parseSalaryNumber(toStr) : undefined;
        const currency = mapCurrency(currencyToken);
        if (from || to) return { from: from || undefined, to, currency, period: 'monthly' };
      }
    }

    // Try implicit RUB range: "30К — 50К", "До 35К"
    const implicit = decoded.match(IMPLICIT_RUB_SALARY_PATTERN);
    if (implicit) {
      if (implicit[1] && implicit[2]) {
        return { from: parseSalaryNumber(`${implicit[1]}k`), to: parseSalaryNumber(`${implicit[2]}k`), currency: 'RUB', period: 'monthly' };
      }
      if (implicit[3]) {
        return { to: parseSalaryNumber(`${implicit[3]}k`), currency: 'RUB', period: 'monthly' };
      }
    }

    // Try "тыс" (thousands) format: "200-300 тыс", "150 тыс"
    const tystMatch = decoded.match(TYST_SALARY_PATTERN);
    if (tystMatch) {
      if (tystMatch[1] && tystMatch[2]) {
        return { from: Number(tystMatch[1]) * 1000, to: Number(tystMatch[2]) * 1000, currency: 'RUB', period: 'monthly' };
      }
      if (tystMatch[3]) {
        return { to: Number(tystMatch[3]) * 1000, currency: 'RUB', period: 'monthly' };
      }
    }

    // Try "от" (from) prefix: "от 200к", "от 180 000 руб"
    const fromMatch = decoded.match(FROM_SALARY_PATTERN);
    if (fromMatch) {
      const amount = parseSalaryNumber(fromMatch[1]!);
      const currencyToken = fromMatch[2]!;
      const currency = currencyToken.toLowerCase() === 'к' ? 'RUB' : mapCurrency(currencyToken);
      const finalAmount = currencyToken.toLowerCase() === 'к' ? amount * 1000 : amount;
      if (finalAmount) return { from: finalAmount, currency, period: 'monthly' };
    }

    // Try single salary with currency: "$3000", "€5000", "180000 тг"
    const singleMatch = decoded.match(SINGLE_SALARY_PATTERN);
    if (singleMatch) {
      const currencyToken = singleMatch[1] || singleMatch[4]!;
      const amountStr = singleMatch[2] || singleMatch[3]!;
      const amount = parseSalaryNumber(amountStr);
      const currency = mapCurrency(currencyToken);
      if (amount) return { from: amount, currency, period: 'monthly' };
    }

    return undefined;
  }

  private extractTechnologies(text: string): string[] {
    const lower = text.toLowerCase();
    return [...new Set(TECH_KEYWORDS.filter((tech) => lower.includes(tech)))];
  }

  private extractContacts(msg: TelegramRawMessage): ExtractedContacts {
    const linksWithText = extractLinksWithText(msg.textHtml);

    const isHashtagSearchLink = (href: string) => href.startsWith('?');
    const isTmeLink = (href: string) => /^https?:\/\/t\.me\//i.test(href);

    const externalLinks = linksWithText.filter((l) => !isHashtagSearchLink(l.href) && !isTmeLink(l.href) && /^https?:\/\//i.test(l.href));
    const tmeUsernameLinks = msg.links.filter((href) => TME_USERNAME_LINK_PATTERN.test(href));

    const emails = [...new Set(msg.text.match(EMAIL_PATTERN) ?? [])];
    const telegramUsernames = [...new Set([...msg.text.matchAll(TELEGRAM_USERNAME_PATTERN)].map((m) => m[1]!))];

    // Priority: apply keyword match > external link > t.me username link > telegram username > email
    const applyLink = externalLinks.find((l) => {
      const haystack = `${l.text} ${l.href}`.toLowerCase();
      return APPLY_KEYWORDS.some((k) => haystack.includes(k));
    });

    // Also check for career page patterns
    const careerPageLink = externalLinks.find((l) => {
      const href = l.href.toLowerCase();
      return href.includes('/career') || href.includes('/vacancy') || href.includes('/jobs') || href.includes('/join');
    });

    const applyUrl =
      applyLink?.href ??
      careerPageLink?.href ??
      externalLinks[0]?.href ??
      tmeUsernameLinks[0] ??
      (telegramUsernames[0] ? `https://t.me/${telegramUsernames[0]}` : undefined) ??
      (emails[0] ? `mailto:${emails[0]}` : undefined);

    return { applyUrl, emails, telegramUsernames };
  }
}

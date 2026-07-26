import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TelegramFetcher } from '../telegram-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(__dirname, '../__fixtures__/telegram-channel-frontend_jobs.html'), 'utf-8');

function htmlResponse(body: string, init?: Partial<{ ok: boolean; status: number; url: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    url: init?.url ?? 'https://t.me/s/frontend_jobs',
    text: async () => body,
  } as Response;
}

describe('TelegramFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new TelegramFetcher({ channels: ['frontend_jobs'], logger, metrics, tracer });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a recorded channel preview page into RawJobs, skipping service messages and non-vacancy chatter', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(fixtureHtml));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 6 posts in the fixture: a "Channel photo updated" service message and a
    // plain chit-chat message are correctly excluded, leaving 4 real vacancies.
    expect(result.data).toHaveLength(4);
    expect(result.data.map((j) => j.sourceId)).toEqual([
      'frontend_jobs:102',
      'frontend_jobs:103',
      'frontend_jobs:104',
      'frontend_jobs:105',
    ]);
  });

  it('extracts title/location/company from a "TITLE | LOCATION | COMPANY" pipe-delimited post', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(fixtureHtml));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const job = result.data.find((j) => j.sourceId === 'frontend_jobs:102');
    expect(job?.title).toBe('Senior Frontend Developer');
    expect(job?.companyName).toBe('Rocket Sci');
    expect(job?.location).toBe('Remote Russia');
    expect(job?.remote).toBe(true);
    expect(job?.technologies).toEqual(expect.arrayContaining(['typescript', 'react']));
    expect(job?.salary).toBeUndefined();
    // First non-hashtag external link becomes the apply URL.
    expect(job?.url).toBe('https://teletype.in/@rocketsci/frontend-role');
  });

  it('extracts labeled RU fields (Компания/Город/Зарплата) plus salary, tech, email, and a Telegram contact', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(fixtureHtml));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const job = result.data.find((j) => j.sourceId === 'frontend_jobs:103');
    expect(job?.title).toBe('Backend Developer (Python/Django)');
    expect(job?.companyName).toBe('TechCorp');
    expect(job?.location).toBe('Москва');
    expect(job?.remote).toBe(false);
    expect(job?.salary).toEqual({ from: 200000, to: 300000, currency: 'RUB', period: 'monthly' });
    expect(job?.technologies).toEqual(expect.arrayContaining(['python', 'django', 'postgresql', 'docker']));
    expect(job?.extensions?.emails).toEqual(['hr@techcorp.example']);
    expect(job?.extensions?.telegramUsernames).toEqual(['hr_techcorp']);
    // No external (non-t.me) link in this post — falls back to the t.me contact.
    expect(job?.url).toBe('https://t.me/hr_techcorp');
  });

  it('falls back to sensible defaults for a post with no company/salary/tech signal', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(fixtureHtml));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const job = result.data.find((j) => j.sourceId === 'frontend_jobs:104');
    expect(job?.companyName).toBe('Unknown');
    expect(job?.location).toBe('Не указано');
    expect(job?.salary).toBeUndefined();
    expect(job?.technologies).toEqual([]);
    // No contact link at all — falls back to the post's own t.me URL.
    expect(job?.url).toBe('https://t.me/frontend_jobs/104');
  });

  it('produces a channel-qualified sourceId so cross-channel collisions are impossible', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(fixtureHtml));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const job of result.data) {
      expect(job.sourceId.startsWith('frontend_jobs:')).toBe(true);
    }
  });

  describe('multi-channel fetch', () => {
    it('continues to other channels when one channel fetch fails', async () => {
      const multiFetcher = new TelegramFetcher({ channels: ['broken_channel', 'frontend_jobs'], logger, metrics, tracer });

      vi.mocked(fetch)
        .mockResolvedValueOnce(htmlResponse('', { ok: false, status: 404, url: 'https://t.me/s/broken_channel' }))
        .mockResolvedValueOnce(htmlResponse(fixtureHtml));

      const result = await multiFetcher.search({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(4);
      expect(result.data.every((j) => j.sourceId.startsWith('frontend_jobs:'))).toBe(true);
    });
  });

  describe('getVacancy', () => {
    it('finds a single vacancy by its channel-qualified sourceId', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(fixtureHtml));

      const result = await fetcher.getVacancy('frontend_jobs:103');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data?.title).toBe('Backend Developer (Python/Django)');
    });

    it('returns null for a channel that was never configured', async () => {
      const result = await fetcher.getVacancy('unknown_channel:1');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBeNull();
    });
  });

  describe('ping', () => {
    it('reports healthy when the first configured channel responds ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(fixtureHtml));

      const result = await fetcher.ping();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBe(true);
    });
  });

  it('does not throw on a channel HTML with zero posts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      htmlResponse('<!DOCTYPE html><html><body><main class="tgme_main"></main></body></html>')
    );

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  describe('salary extraction', () => {
    it('extracts salary with explicit currency in range format', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="frontend_jobs/1">
          <div class="tgme_widget_message_text"><p>Python Developer | Moscow | TechCorp</p><p>Salary: 200 000 - 300 000 RUB</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.salary).toEqual({ from: 200000, to: 300000, currency: 'RUB', period: 'monthly' });
    });

    it('extracts salary with currency before number', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="frontend_jobs/2">
          <div class="tgme_widget_message_text"><p>Backend Developer | Remote | Company</p><p>Salary: $3000-4000</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.salary).toEqual({ from: 3000, to: 4000, currency: 'USD', period: 'monthly' });
    });

    it('extracts salary with "тыс" (thousands) suffix', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="frontend_jobs/3">
          <div class="tgme_widget_message_text"><p>DevOps Engineer | Almaty | Company</p><p>Зарплата: 200-300 тыс</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.salary).toEqual({ from: 200000, to: 300000, currency: 'RUB', period: 'monthly' });
    });

    it('extracts salary with "от" (from) prefix', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="frontend_jobs/4">
          <div class="tgme_widget_message_text"><p>QA Engineer | Remote | Company</p><p>от 200к</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.salary).toEqual({ from: 200000, currency: 'RUB', period: 'monthly' });
    });

    it('extracts salary with HTML-encoded currency symbol', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="frontend_jobs/5">
          <div class="tgme_widget_message_text"><p>Golang Developer | Remote | Company</p><p>Salary: &#036;2000-5000</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.salary).toEqual({ from: 2000, to: 5000, currency: 'USD', period: 'monthly' });
    });

    it('extracts single salary amount with currency', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="frontend_jobs/6">
          <div class="tgme_widget_message_text"><p>Frontend Developer | Remote | Company</p><p>Оплата: 180000 тг</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.salary).toEqual({ from: 180000, currency: 'KZT', period: 'monthly' });
    });
  });

  describe('apply URL extraction', () => {
    it('uses source URL from text when no explicit apply link exists', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="test/7">
          <div class="tgme_widget_message_text"><p>Python Developer | Remote | Company</p><p>Apply here: https://company.com/careers/123</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.url).toBe('https://company.com/careers/123');
    });

    it('extracts LinkedIn job URLs from text', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="test/8">
          <div class="tgme_widget_message_text"><p>DevOps Engineer | Remote | Company</p><p>https://www.linkedin.com/jobs/view/4431708009/</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.url).toContain('linkedin.com/jobs/view');
    });

    it('extracts teletype.in URLs from text', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="test/9">
          <div class="tgme_widget_message_text"><p>Java Developer | Remote | Company</p><p>https://teletype.in/@company/post123</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.url).toContain('teletype.in');
    });

    it('falls back to t.me post URL when no external URL found', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="frontend_jobs/10">
          <div class="tgme_widget_message_text"><p>QA Engineer | Remote | Company</p><p>No links here</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.url).toBe('https://t.me/frontend_jobs/10');
    });
  });

  describe('company extraction', () => {
    it('extracts company from "Компания:" label', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="test/11">
          <div class="tgme_widget_message_text"><p>Python Developer | Remote</p><p>Компания: Яндекс</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.companyName).toBe('Яндекс');
    });

    it('extracts company from "в Company —" pattern', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="frontend_jobs/12">
          <div class="tgme_widget_message_text"><p>Middle Developer</p><p>в Сбер — ищем middle разработчика</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // The "в Company —" pattern requires a newline before "в"
      // In this test case, the <p> tags create separate paragraphs
      // which get converted to newlines by htmlToText
      expect(result.data[0]?.companyName).toBe('Сбер');
    });
  });

  describe('title normalization', () => {
    it('normalizes ALL CAPS titles to Title Case', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="test/13">
          <div class="tgme_widget_message_text"><p>SENIOR PYTHON DEVELOPER | Remote | Company</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.title).toBe('Senior Python Developer');
    });

    it('preserves common tech abbreviations in title case', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="test/14">
          <div class="tgme_widget_message_text"><p>SENIOR QA ENGINEER | Remote | Company</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.title).toBe('Senior QA Engineer');
    });

    it('removes trailing "or" from titles', async () => {
      const html = `<div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="test/15">
          <div class="tgme_widget_message_text"><p>SENIOR JAVA DEVELOPER | REMOTE OR RELOCATION or | Company</p></div>
        </div>
      </div>`;
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(html));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]?.title).toBe('Senior Java Developer');
    });
  });
});

describe('TelegramFetcher - Dynamic Channel Loading', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses channelProvider to resolve channels dynamically', async () => {
    const channelProvider = vi.fn().mockResolvedValue(['dynamic_channel']);
    const fetcher = new TelegramFetcher({
      channels: ['static_channel'],
      logger,
      metrics,
      tracer,
      channelProvider,
    });

    const html = `<div class="tgme_widget_message_wrap">
      <div class="tgme_widget_message" data-post="dynamic_channel/1">
        <div class="tgme_widget_message_text"><p>HIRING: React Developer | Remote | TestCorp</p></div>
      </div>
    </div>`;
    vi.mocked(fetch).mockResolvedValue(htmlResponse(html, { url: 'https://t.me/s/dynamic_channel' }));

    const result = await fetcher.search({});

    expect(channelProvider).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.sourceId).toBe('dynamic_channel:1');
  });

  it('falls back to static channels when channelProvider fails', async () => {
    const channelProvider = vi.fn().mockRejectedValue(new Error('DB unavailable'));
    const fetcher = new TelegramFetcher({
      channels: ['fallback_channel'],
      logger,
      metrics,
      tracer,
      channelProvider,
    });

    const html = `<div class="tgme_widget_message_wrap">
      <div class="tgme_widget_message" data-post="fallback_channel/1">
        <div class="tgme_widget_message_text"><p>HIRING: Vue Developer | Remote | FallbackCorp</p></div>
      </div>
    </div>`;
    vi.mocked(fetch).mockResolvedValue(htmlResponse(html, { url: 'https://t.me/s/fallback_channel' }));

    const result = await fetcher.search({});

    expect(channelProvider).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.sourceId).toBe('fallback_channel:1');
  });

  it('falls back to static channels when channelProvider returns empty', async () => {
    const channelProvider = vi.fn().mockResolvedValue([]);
    const fetcher = new TelegramFetcher({
      channels: ['static_only'],
      logger,
      metrics,
      tracer,
      channelProvider,
    });

    const html = `<div class="tgme_widget_message_wrap">
      <div class="tgme_widget_message" data-post="static_only/1">
        <div class="tgme_widget_message_text"><p>HIRING: Go Developer | Remote | StaticCorp</p></div>
      </div>
    </div>`;
    vi.mocked(fetch).mockResolvedValue(htmlResponse(html, { url: 'https://t.me/s/static_only' }));

    const result = await fetcher.search({});

    expect(channelProvider).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.sourceId).toBe('static_only:1');
  });

  it('skips disabled channels not returned by channelProvider', async () => {
    const channelProvider = vi.fn().mockResolvedValue(['enabled_only']);
    const fetcher = new TelegramFetcher({
      channels: ['disabled_channel', 'enabled_only'],
      logger,
      metrics,
      tracer,
      channelProvider,
    });

    const enabledHtml = `<div class="tgme_widget_message_wrap">
      <div class="tgme_widget_message" data-post="enabled_only/1">
        <div class="tgme_widget_message_text"><p>HIRING: DevOps | Remote | EnabledCorp</p></div>
      </div>
    </div>`;
    vi.mocked(fetch).mockResolvedValue(htmlResponse(enabledHtml, { url: 'https://t.me/s/enabled_only' }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.sourceId).toBe('enabled_only:1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

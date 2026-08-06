import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DjangoJobsFetcher } from '../djangojobs-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

function textResponse(body: string, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    text: async () => body,
  } as Response;
}

const BWD_RSS = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Django Jobs</title><item><title>Lead Engineer at Relevant Healthcare</title><link>http://builtwithdjango.com/jobs/2409/lead-engineer</link><description>Relevant builds a data platform for healthcare providers.</description><guid>http://builtwithdjango.com/jobs/2409/lead-engineer</guid></item></channel></rss>`;

const DJB_ATOM = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Django Job Board</title><entry><title>Security Developer</title><link href="https://djangojobboard.com/2287/security-developer-python-software-foundation-career-page/" rel="alternate"/><updated>2026-07-27T23:34:11.940286+00:00</updated><id>https://djangojobboard.com/2287/security-developer-python-software-foundation-career-page/</id><summary type="html">&lt;p&gt;Work with the Python Security Response Team.&lt;/p&gt;</summary></entry></feed>`;

describe('DjangoJobsFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  function makeFetcher(): DjangoJobsFetcher {
    return new DjangoJobsFetcher({
      builtWithDjangoUrl: 'https://builtwithdjango.com/jobs/feed/rss',
      djangoJobBoardUrl: 'https://djangojobboard.com/feed/atom/',
      logger,
      metrics,
      tracer,
    });
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('merges the RSS (builtwithdjango) and Atom (djangojobboard) feeds', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch)
      .mockResolvedValueOnce(textResponse(BWD_RSS))
      .mockResolvedValueOnce(textResponse(DJB_ATOM));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2);

    const bwd = result.data.find((j) => j.sourceId === 'django-bwd-2409');
    expect(bwd?.title).toBe('Lead Engineer');
    expect(bwd?.companyName).toBe('Relevant Healthcare');

    const djb = result.data.find((j) => j.sourceId === 'django-djb-2287');
    expect(djb?.title).toBe('Security Developer');
    expect(djb?.companyName).toBe('Unknown');
    expect(djb?.description).toContain('Python Security Response Team');
    expect(djb?.publishedAt.toISOString()).toBe('2026-07-27T23:34:11.940Z');
  });

  it('returns a network error when either feed fails', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch)
      .mockResolvedValueOnce(textResponse(BWD_RSS))
      .mockResolvedValueOnce(textResponse('', { ok: false, status: 404, statusText: 'Not Found' }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
  });
});

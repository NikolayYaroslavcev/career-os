import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PyJobsFetcher } from '../pyjobs-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

function rssResponse(items: string[], init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>PyJobs</title>${items.join('')}</channel></rss>`;
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    text: async () => xml,
  } as Response;
}

function item(title: string, link: string, description: string, pubDate?: string): string {
  return `<item><title><![CDATA[${title}]]></title><link>${link}</link><description><![CDATA[${description}]]></description>${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}</item>`;
}

describe('PyJobsFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  function makeFetcher(): PyJobsFetcher {
    return new PyJobsFetcher({ baseUrl: 'https://www.pyjobs.com/rss', logger, metrics, tracer });
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses company/work-mode/employment-type out of the packed description line, dropping the always-zero salary', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch).mockResolvedValueOnce(rssResponse([
      item(
        'Senior Data Engineer',
        'https://www.pyjobs.com/job/senior-data-engineer-backend-apis-AMbpzJGl',
        'ai-omatic solutions GmbH / Hybrid / $0 to $0 / Full-time',
        'Thu, 30 Jul 2026 05:30:02 +0000',
      ),
      item(
        'Polyglot Engineer (JS/Python/Go)',
        'https://www.pyjobs.com/job/polyglot-engineer-jspythongo-eMQbl1Pz',
        'YLD.com / Geo remote / $0 to $0 / Full-time',
      ),
    ]));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2);
    const first = result.data[0]!;
    expect(first.sourceId).toBe('pyjobs-senior-data-engineer-backend-apis-AMbpzJGl');
    expect(first.companyName).toBe('ai-omatic solutions GmbH');
    expect(first.remote).toBe(false);
    expect(first.employmentType).toBe('full_time');
    expect(first.salary).toBeUndefined();

    const second = result.data[1]!;
    expect(second.companyName).toBe('YLD.com');
    expect(second.remote).toBe(true);
    // No pubDate in the fixture — falls back to fetch time rather than throwing.
    expect(second.publishedAt).toBeInstanceOf(Date);
  });

  it('returns a network error on a permanent HTTP failure', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch).mockResolvedValueOnce(rssResponse([], { ok: false, status: 404, statusText: 'Not Found' }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
  });
});

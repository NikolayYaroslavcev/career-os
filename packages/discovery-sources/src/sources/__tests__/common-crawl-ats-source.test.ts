import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommonCrawlAtsDiscoverySource } from '../common-crawl-ats-source.js';

const COLLINFO = JSON.stringify([{ id: 'CC-MAIN-2026-30', 'cdx-api': 'https://index.commoncrawl.org/CC-MAIN-2026-30-index' }]);

function ndjson(records: Record<string, unknown>[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n');
}

describe('CommonCrawlAtsDiscoverySource', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts a company slug per matched Greenhouse URL and advances the cursor to the next page', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => JSON.parse(COLLINFO) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          ndjson([
            { urlkey: 'x', url: 'https://boards.greenhouse.io/acme/jobs/1', timestamp: '20260101', status: '200' },
            { urlkey: 'y', url: 'https://boards.greenhouse.io/acme/jobs/2', timestamp: '20260102', status: '200' },
            { urlkey: 'z', url: 'https://boards.greenhouse.io/robots.txt', timestamp: '20260101', status: '200' },
          ]),
      });

    const source = new CommonCrawlAtsDiscoverySource();
    const result = await source.fetch(null);

    expect(result.tuples).toHaveLength(1);
    expect(result.tuples[0]?.name).toBe('acme');
    expect(result.tuples[0]?.url).toBe('https://boards.greenhouse.io/acme');
    expect(result.tuples[0]?.sourceAuthorityScore).toBe(source.defaultAuthorityScore);
    expect(result.hasMore).toBe(true);

    const cursor = result.cursor as { patternIndex: number; page: number };
    expect(cursor.patternIndex).toBe(0);
    expect(cursor.page).toBe(1);
  });

  it('prefers a redirect target host over a retired pattern host (ADR-035 Phase 4: boards.greenhouse.io -> job-boards.greenhouse.io migration, live-verified 2026-07-30)', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => JSON.parse(COLLINFO) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          ndjson([
            {
              urlkey: 'x',
              url: 'https://boards.greenhouse.io/acme/jobs/1',
              timestamp: '20260101',
              status: '301',
              redirect: 'https://job-boards.greenhouse.io/acme/jobs/1',
            },
          ]),
      });

    const source = new CommonCrawlAtsDiscoverySource();
    const result = await source.fetch(null);

    expect(result.tuples).toHaveLength(1);
    expect(result.tuples[0]?.url).toBe('https://job-boards.greenhouse.io/acme');
    expect(result.tuples[0]?.crawlMetadata).toMatchObject({ redirectedTo: 'https://job-boards.greenhouse.io/acme/jobs/1' });
  });

  it('advances to the next ATS host pattern once a pattern returns no records', async () => {
    const cursorIn = { patternIndex: 0, page: 3, cdxApiUrl: 'https://index.commoncrawl.org/CC-MAIN-2026-30-index' };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' });

    const source = new CommonCrawlAtsDiscoverySource();
    const result = await source.fetch(cursorIn);

    expect(result.tuples).toHaveLength(0);
    const cursor = result.cursor as { patternIndex: number; page: number };
    expect(cursor.patternIndex).toBe(1);
    expect(cursor.page).toBe(0);
    expect(result.hasMore).toBe(true);
  });

  it('signals exhaustion once every ATS host pattern has been scanned', async () => {
    const cursorIn = { patternIndex: 5, page: 0, cdxApiUrl: 'https://index.commoncrawl.org/CC-MAIN-2026-30-index' };
    const source = new CommonCrawlAtsDiscoverySource();
    const result = await source.fetch(cursorIn);

    expect(result.tuples).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

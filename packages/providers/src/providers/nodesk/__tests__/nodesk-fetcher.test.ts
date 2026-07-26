import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NoDeskFetcher } from '../nodesk-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureXml = readFileSync(join(__dirname, '../__fixtures__/nodesk-response.xml'), 'utf-8');

function textResponse(body: string, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    text: async () => body,
  } as Response;
}

describe('NoDeskFetcher (contract)', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new NoDeskFetcher({
    baseUrl: 'https://nodesk.co/remote-jobs/feed/',
    logger,
    metrics,
    tracer,
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a recorded RSS feed without throwing, preserving required fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(textResponse(fixtureXml));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);

    const [full, minimal, empty] = result.data;
    expect(full?.title).toBe('Senior Frontend Engineer');
    expect(full?.sourceId).toBe('https://nodesk.co/remote-jobs/acme/senior-frontend-engineer/');
    expect(full?.url).toBe('https://nodesk.co/remote-jobs/acme/senior-frontend-engineer/');
    expect(full?.description).toBe('Build our design system with React and TypeScript.');
    expect(full?.technologies).toEqual(['engineering']);
    expect(full?.companyName).toBe('Unknown');
    expect(full?.remote).toBe(true);

    // Optional field (category) missing is handled safely.
    expect(minimal?.title).toBe('Remote Bookkeeper');
    expect(minimal?.technologies).toEqual([]);

    // Empty title/description/link doesn't crash parsing — falls back to a positional sourceId.
    expect(empty?.title).toBe('');
    expect(empty?.sourceId).toBe('https://nodesk.co/remote-jobs/no-title-job/');
  });

  it('does not throw and returns an empty list for a feed with no items', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      textResponse('<?xml version="1.0"?><rss><channel><title>Empty</title></channel></rss>')
    );

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('does not throw on completely malformed (non-XML) payloads', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(textResponse('this is not xml at all {{{'));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('returns a network error instead of throwing on a non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(textResponse('', { ok: false, status: 404 }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
  });
});

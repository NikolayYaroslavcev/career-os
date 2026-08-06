/**
 * ADR-033 Phase 2 (Greenhouse pilot) regression test: `packages/providers`'
 * `GreenhouseFetcher` and `packages/company-watch`'s `GreenhouseAdapter` both
 * now delegate to the same `@careeros/ats-adapters` Greenhouse adapter for
 * transport + parsing. This proves they still produce identical results for
 * the fields they share, from the exact same mocked API response — the
 * property ADR-033 requires before any further ATS migrates.
 *
 * The Lever section below (ADR-033 addendum "Lever migration parity") is a
 * different kind of test: unlike Greenhouse, Provider and Company Watch never
 * agreed on Lever's URL, technology extraction, or salary field to begin
 * with. Its assertions prove the two consumers still diverge in exactly the
 * same documented ways after migrating onto the shared transport/parser —
 * i.e. that sharing the HTTP/parsing code did NOT quietly unify behavior
 * that was never identical.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GreenhouseFetcher,
  LeverFetcher,
  SmartRecruitersFetcher,
  ConsoleLogger,
  InMemoryMetricsCollector,
  InMemoryTracer,
} from '@careeros/providers';
import { GreenhouseAdapter, LeverAdapter, SmartRecruitersAdapter } from '@careeros/company-watch';

const FIXTURE_RESPONSE = {
  jobs: [
    {
      id: 4028547,
      title: 'Senior Backend Engineer',
      updated_at: '2026-07-10T12:00:00-04:00',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/4028547',
      location: { name: 'Remote - US' },
      content: '<p>We are looking for a Senior Backend Engineer.</p>',
      departments: [{ id: 1, name: 'Engineering' }],
      metadata: [{ id: 1, name: 'Technologies', value: 'Go, Kubernetes, PostgreSQL' }],
      pay_input_ranges: [{ min_cents: 15000000, max_cents: 19000000, currency_type: 'USD' }],
    },
    {
      id: 4028548,
      title: 'Product Designer',
      updated_at: '2026-07-09T09:30:00-04:00',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/4028548',
      location: { name: 'New York, NY' },
      content: '<p>Join our design team.</p>',
      departments: [{ id: 2, name: 'Design' }],
      metadata: [{ id: 2, name: 'Skills', value: 'Figma, Prototyping' }],
      pay_input_ranges: null,
    },
  ],
};

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body } as Response;
}

describe('ATS adapter parity: Provider vs. Company Watch (Greenhouse)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('produces identical requests, URLs, salary parsing, and metadata extraction for both consumers', async () => {
    // Provider: single-tenant Fetcher, configured from env-style config.
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));
    const fetcher = new GreenhouseFetcher({
      baseUrl: 'https://boards-api.greenhouse.io/v1/boards',
      boardToken: 'acme',
      companyName: 'Acme Corp',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const providerResult = await fetcher.search({});
    expect(providerResult.ok).toBe(true);
    if (!providerResult.ok) return;

    // Company Watch: multi-tenant AtsAdapter, configured from a per-row AtsConfig.
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));
    const adapter = new GreenhouseAdapter();
    const watchJobs = await adapter.fetchJobs({
      careerUrl: 'https://boards.greenhouse.io/acme',
      metadata: { boardToken: 'acme' },
    });

    expect(providerResult.data).toHaveLength(watchJobs.length);

    // Requests: same board, same URL construction.
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true',
      expect.anything(),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true',
      expect.anything(),
    );

    for (let i = 0; i < providerResult.data.length; i++) {
      const providerJob = providerResult.data[i]!;
      const watchJob = watchJobs[i]!;

      // Identical parsing: sourceId/externalId, title, URL.
      expect(providerJob.sourceId).toBe(watchJob.externalId);
      expect(providerJob.title).toBe(watchJob.title);
      expect(providerJob.url).toBe(watchJob.url);

      // Identical salary parsing (cents -> units, USD default).
      expect(providerJob.salary ? { min: providerJob.salary.from, max: providerJob.salary.to, currency: providerJob.salary.currency } : undefined).toEqual(
        watchJob.salary,
      );

      // Identical metadata/technology extraction.
      expect(providerJob.technologies).toEqual(watchJob.technologies);
    }
  });

  it('classifies a 429 identically at each consumer boundary (shared transport, consumer-owned error contract)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      { ok: false, status: 429, statusText: 'Too Many Requests', json: async () => null } as Response,
    );
    const fetcher = new GreenhouseFetcher({
      baseUrl: 'https://boards-api.greenhouse.io/v1/boards',
      boardToken: 'acme',
      companyName: 'Acme Corp',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('RATE_LIMITED');

    vi.mocked(fetch).mockResolvedValueOnce(
      { ok: false, status: 429, statusText: 'Too Many Requests', json: async () => null } as Response,
    );
    const adapter = new GreenhouseAdapter();
    await expect(
      adapter.fetchJobs({ careerUrl: 'https://boards.greenhouse.io/acme', metadata: { boardToken: 'acme' } }),
    ).rejects.toThrow('Greenhouse API error: 429 Too Many Requests');
  });
});

const LEVER_FIXTURE_RESPONSE = [
  {
    id: 'a1b2c3d4-1111-2222-3333-444455556666',
    text: 'Senior Backend Engineer',
    categories: {
      commitment: 'Full-time',
      department: 'Engineering',
      location: 'Remote - US',
      team: 'Platform',
      allLocations: ['Remote - US'],
    },
    description: '<div>We are looking for a Senior Backend Engineer to join our platform team using React.</div>',
    descriptionPlain: 'We are looking for a Senior Backend Engineer to join our platform team using React.',
    lists: [],
    hostedUrl: 'https://jobs.lever.co/acme/a1b2c3d4-1111-2222-3333-444455556666',
    applyUrl: 'https://jobs.lever.co/acme/a1b2c3d4-1111-2222-3333-444455556666/apply',
    createdAt: 1752105600000,
    workplaceType: 'remote',
    salaryRange: { min: 150000, max: 190000, currency: 'USD', interval: 'per-year-salary' },
    tags: ['go', 'kubernetes'],
  },
];

function leverJsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

/**
 * ADR-033 addendum "Lever migration parity": Provider and Company Watch both
 * now share the same `@careeros/ats-adapters` HTTP/parsing code for Lever,
 * but — unlike Greenhouse — their pre-migration behavior was never identical
 * to begin with (see the ADR addendum for the full line-by-line trace). These
 * tests pin the divergences down as regressions, not just prose: sharing the
 * transport must not silently unify them.
 */
describe('ATS adapter parity: Provider vs. Company Watch (Lever) — documented divergences', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests different URLs by design: Provider always paginates (mode=json&skip&limit), Company Watch fetches the whole board unpaged', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(leverJsonResponse(LEVER_FIXTURE_RESPONSE));
    const fetcher = new LeverFetcher({
      baseUrl: 'https://api.lever.co/v0/postings',
      company: 'acme',
      companyName: 'Acme Corp',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    await fetcher.search({});
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.lever.co/v0/postings/acme?mode=json&skip=0&limit=100',
      expect.anything(),
    );

    vi.mocked(fetch).mockResolvedValueOnce(leverJsonResponse(LEVER_FIXTURE_RESPONSE));
    const adapter = new LeverAdapter();
    await adapter.fetchJobs({ careerUrl: 'https://jobs.lever.co/acme', metadata: { company: 'acme' } });
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://api.lever.co/v0/postings/acme', expect.anything());
  });

  it('derives technologies from different source data: Provider copies raw `tags`, Company Watch regex-matches the description', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(leverJsonResponse(LEVER_FIXTURE_RESPONSE));
    const fetcher = new LeverFetcher({
      baseUrl: 'https://api.lever.co/v0/postings',
      company: 'acme',
      companyName: 'Acme Corp',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const providerResult = await fetcher.search({});
    expect(providerResult.ok).toBe(true);
    if (!providerResult.ok) return;

    vi.mocked(fetch).mockResolvedValueOnce(leverJsonResponse(LEVER_FIXTURE_RESPONSE));
    const adapter = new LeverAdapter();
    const watchJobs = await adapter.fetchJobs({ careerUrl: 'https://jobs.lever.co/acme', metadata: { company: 'acme' } });

    // Provider: verbatim tags from the posting.
    expect(providerResult.data[0]?.technologies).toEqual(['go', 'kubernetes']);
    // Company Watch: regex over the description text — picks up "React" (not tagged) and "kubernetes" (mentioned in prose too).
    expect(watchJobs[0]?.technologies).toEqual(expect.arrayContaining(['react']));
    expect(watchJobs[0]?.technologies).not.toEqual(providerResult.data[0]?.technologies);
  });

  it('surfaces salary only on the Provider side: Company Watch reads a `salary` field that does not exist on real Lever postings (documented bug, preserved not fixed)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(leverJsonResponse(LEVER_FIXTURE_RESPONSE));
    const fetcher = new LeverFetcher({
      baseUrl: 'https://api.lever.co/v0/postings',
      company: 'acme',
      companyName: 'Acme Corp',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const providerResult = await fetcher.search({});
    expect(providerResult.ok).toBe(true);
    if (!providerResult.ok) return;
    expect(providerResult.data[0]?.salary).toEqual({ from: 150000, to: 190000, currency: 'USD', period: 'yearly' });

    vi.mocked(fetch).mockResolvedValueOnce(leverJsonResponse(LEVER_FIXTURE_RESPONSE));
    const adapter = new LeverAdapter();
    const watchJobs = await adapter.fetchJobs({ careerUrl: 'https://jobs.lever.co/acme', metadata: { company: 'acme' } });
    expect(watchJobs[0]?.salary).toBeUndefined();
  });

  it('classifies a 429 identically at each consumer boundary (shared transport, consumer-owned error contract)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      { ok: false, status: 429, statusText: 'Too Many Requests', json: async () => null } as Response,
    );
    const fetcher = new LeverFetcher({
      baseUrl: 'https://api.lever.co/v0/postings',
      company: 'acme',
      companyName: 'Acme Corp',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('RATE_LIMITED');

    vi.mocked(fetch).mockResolvedValueOnce(
      { ok: false, status: 429, statusText: 'Too Many Requests', json: async () => null } as Response,
    );
    const adapter = new LeverAdapter();
    await expect(
      adapter.fetchJobs({ careerUrl: 'https://jobs.lever.co/acme', metadata: { company: 'acme' } }),
    ).rejects.toThrow('Lever API error: 429 Too Many Requests');
  });
});

const SMARTRECRUITERS_FIXTURE_RESPONSE = {
  offset: 0,
  limit: 100,
  totalFound: 1,
  content: [
    {
      id: '7f8a9b2c-0001',
      name: 'Senior Backend Engineer',
      ref: 'posting-0001',
      department: { id: 'd1', name: 'Engineering' },
      occupationArea: { id: 'o1', name: 'Software Engineering' },
      industry: null,
      city: 'Berlin',
      country: 'Germany',
      location: { city: 'Berlin', region: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.405 },
      experienceLevel: { id: 'e1', name: 'Senior' },
      employmentType: { id: 't1', name: 'Full-time' },
      salary: { min: 70000, max: 95000, currency: 'EUR', unit: 'Annual' },
      description: 'We are looking for a Senior Backend Engineer to join our platform team using React and Kubernetes.',
      releasedDate: '2026-07-10T12:00:00.000Z',
      applyUrl: 'https://jobs.smartrecruiters.com/acme/7f8a9b2c-0001',
      language: 'en',
    },
  ],
};

function smartRecruitersJsonResponse(
  body: unknown,
  init?: Partial<{ ok: boolean; status: number; statusText: string }>,
): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

/**
 * ADR-033 SmartRecruiters migration: unlike Greenhouse/Lever, company-watch
 * had NO prior SmartRecruiters adapter at all — `AtsType` declared
 * `SMARTRECRUITERS` but `AtsAdapterRegistry.get()` threw for it (the
 * "concrete gap" ADR-033 flags). This migration closes that gap by having
 * company-watch's new `SmartRecruitersAdapter` delegate wholesale to
 * `@careeros/ats-adapters`' shared adapter, the same one providers' Fetcher
 * composes transport/parser functions from. Because there was no legacy
 * company-watch behavior to preserve, both consumers now share identical
 * listing/parsing semantics (like Greenhouse, not like Lever's divergent
 * pair) — but providers' own error-handling and single-job quirks predate
 * this migration and are preserved regardless, pinned down below.
 */
describe('ATS adapter parity: Provider vs. Company Watch (SmartRecruiters)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('produces identical requests, URLs, salary parsing, and location/department extraction for both consumers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(smartRecruitersJsonResponse(SMARTRECRUITERS_FIXTURE_RESPONSE));
    const fetcher = new SmartRecruitersFetcher({
      baseUrl: 'https://api.smartrecruiters.com/v1',
      company: 'acme',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const providerResult = await fetcher.search({});
    expect(providerResult.ok).toBe(true);
    if (!providerResult.ok) return;

    vi.mocked(fetch).mockResolvedValueOnce(smartRecruitersJsonResponse(SMARTRECRUITERS_FIXTURE_RESPONSE));
    const adapter = new SmartRecruitersAdapter();
    const watchJobs = await adapter.fetchJobs({
      careerUrl: 'https://jobs.smartrecruiters.com/acme',
      metadata: { company: 'acme' },
    });

    expect(providerResult.data).toHaveLength(watchJobs.length);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.smartrecruiters.com/v1/companies/acme/postings?offset=0&limit=100',
      expect.anything(),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.smartrecruiters.com/v1/companies/acme/postings?offset=0&limit=100',
      expect.anything(),
    );

    for (let i = 0; i < providerResult.data.length; i++) {
      const providerJob = providerResult.data[i]!;
      const watchJob = watchJobs[i]!;

      expect(providerJob.sourceId).toBe(watchJob.externalId);
      expect(providerJob.title).toBe(watchJob.title);
      expect(providerJob.url).toBe(watchJob.url);
      expect(providerJob.location).toBe(watchJob.location);

      expect(providerJob.salary ? { min: providerJob.salary.from, max: providerJob.salary.to, currency: providerJob.salary.currency } : undefined).toEqual(
        watchJob.salary,
      );
    }
  });

  it('derives technologies differently by design: Provider extracts them downstream in the mapper (empty at the fetcher), Company Watch regex-matches the description directly in the adapter', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(smartRecruitersJsonResponse(SMARTRECRUITERS_FIXTURE_RESPONSE));
    const fetcher = new SmartRecruitersFetcher({
      baseUrl: 'https://api.smartrecruiters.com/v1',
      company: 'acme',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const providerResult = await fetcher.search({});
    expect(providerResult.ok).toBe(true);
    if (!providerResult.ok) return;
    expect(providerResult.data[0]?.technologies).toEqual([]);

    vi.mocked(fetch).mockResolvedValueOnce(smartRecruitersJsonResponse(SMARTRECRUITERS_FIXTURE_RESPONSE));
    const adapter = new SmartRecruitersAdapter();
    const watchJobs = await adapter.fetchJobs({
      careerUrl: 'https://jobs.smartrecruiters.com/acme',
      metadata: { company: 'acme' },
    });
    expect(watchJobs[0]?.technologies).toEqual(expect.arrayContaining(['react', 'kubernetes']));
  });

  it('classifies a 429 differently at each consumer boundary: Provider has no rate-limit-specific branch for SmartRecruiters (pre-existing, unlike Greenhouse/Lever), Company Watch surfaces its own error message format', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      { ok: false, status: 429, statusText: 'Too Many Requests', json: async () => null } as Response,
    );
    const fetcher = new SmartRecruitersFetcher({
      baseUrl: 'https://api.smartrecruiters.com/v1',
      company: 'acme',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // NETWORK_ERROR, not RATE_LIMITED — SmartRecruiters' fetcher never had this classification.
    expect(result.error).toBe('NETWORK_ERROR');

    vi.mocked(fetch).mockResolvedValueOnce(
      { ok: false, status: 429, statusText: 'Too Many Requests', json: async () => null } as Response,
    );
    const adapter = new SmartRecruitersAdapter();
    await expect(
      adapter.fetchJobs({ careerUrl: 'https://jobs.smartrecruiters.com/acme', metadata: { company: 'acme' } }),
    ).rejects.toThrow('SmartRecruiters API error: 429 Too Many Requests');
  });

  it('diverges on single-job error handling: Provider’s getVacancy swallows a 500 into "not found" (pre-existing bug, preserved), Company Watch’s fetchJob throws like every other adapter', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => null } as Response,
    );
    const fetcher = new SmartRecruitersFetcher({
      baseUrl: 'https://api.smartrecruiters.com/v1',
      company: 'acme',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const result = await fetcher.getVacancy('some-id');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();

    vi.mocked(fetch).mockResolvedValueOnce(
      { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => null } as Response,
    );
    const adapter = new SmartRecruitersAdapter();
    await expect(
      adapter.fetchJob({ careerUrl: 'https://jobs.smartrecruiters.com/acme', metadata: { company: 'acme' } }, 'some-id'),
    ).rejects.toThrow('SmartRecruiters API error: 500 Internal Server Error');
  });

  it('reproduces the pre-existing companyName-from-department bug on the Provider side only — Company Watch’s AtsJob has no companyName field to be affected', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(smartRecruitersJsonResponse(SMARTRECRUITERS_FIXTURE_RESPONSE));
    const fetcher = new SmartRecruitersFetcher({
      baseUrl: 'https://api.smartrecruiters.com/v1',
      company: 'acme',
      logger: new ConsoleLogger('error'),
      metrics: new InMemoryMetricsCollector(),
      tracer: new InMemoryTracer(),
    });
    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Reads posting.department?.name instead of the fetcher's own configured
    // company name — found during this migration, preserved not fixed.
    expect(result.data[0]?.companyName).toBe('Engineering');
  });
});

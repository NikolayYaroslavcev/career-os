import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FranceTravailFetcher } from '../francetravail-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

function tokenResponse(): Response {
  return jsonResponse({ access_token: 'test-token', expires_in: 1500, token_type: 'Bearer' });
}

function offer(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: '123ABCD',
    intitule: 'Développeur Full Stack',
    description: 'Nous recherchons un développeur Java/React.',
    dateCreation: '2026-07-30T10:00:00.000Z',
    lieuTravail: { libelle: 'Paris (75)' },
    entreprise: { nom: 'Acme SAS' },
    typeContrat: 'CDI',
    salaire: { libelle: 'Annuel de 40000.0 Euros à 50000.0 Euros' },
    origineOffre: { origine: '1', urlOrigine: 'https://candidat.francetravail.fr/offres/recherche/detail/123ABCD' },
    ...overrides,
  };
}

describe('FranceTravailFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  function makeFetcher(): FranceTravailFetcher {
    return new FranceTravailFetcher({
      baseUrl: 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search',
      clientId: 'test-client',
      clientSecret: 'test-secret',
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

  it('fetches an OAuth2 token before searching and parses the freeform French salary text', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ resultats: [offer()] }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    const job = result.data[0]!;
    expect(job.sourceId).toBe('123ABCD');
    expect(job.companyName).toBe('Acme SAS');
    expect(job.salary).toEqual({ from: 40000, to: 50000, currency: 'EUR', period: 'yearly' });
    expect(job.employmentType).toBe('full_time');
    expect(job.url).toBe('https://candidat.francetravail.fr/offres/recherche/detail/123ABCD');

    const [tokenCall, searchCall] = vi.mocked(fetch).mock.calls;
    expect(tokenCall?.[1]).toMatchObject({ method: 'POST' });
    expect(String(searchCall?.[0])).toContain('codeROME=M1805');
  });

  it('reuses a cached token across calls instead of re-authenticating every search', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ resultats: [offer()] }))
      .mockResolvedValueOnce(jsonResponse({ resultats: [] }));

    await fetcher.search({});
    await fetcher.search({});

    const tokenCalls = vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).includes('access_token'));
    expect(tokenCalls).toHaveLength(1);
  });

  it('paginates a full page then stops on a 204 (past the end of the result set)', async () => {
    const fetcher = makeFetcher();
    const fullPage = Array.from({ length: 50 }, (_, i) => offer({ id: `job-${i}` }));
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ resultats: fullPage }))
      .mockResolvedValueOnce(jsonResponse(null, { ok: true, status: 204 }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(50);
  });

  it('drops salary when the freeform text has no parseable numbers', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ resultats: [offer({ salaire: { libelle: 'Selon profil' } })] }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.salary).toBeUndefined();
  });

  it('falls back to the France Travail candidate offer page when urlOrigine is missing', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ resultats: [offer({ origineOffre: undefined })] }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.url).toBe('https://candidat.francetravail.fr/offres/recherche/detail/123ABCD');
  });

  it('returns a network error when the token request itself fails (invalid_client)', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'invalid_client' }, { ok: false, status: 401, statusText: 'Unauthorized' }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
  });
});

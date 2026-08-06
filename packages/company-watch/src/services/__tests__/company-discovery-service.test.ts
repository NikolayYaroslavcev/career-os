import { describe, it, expect, vi, afterEach } from 'vitest';
import { CompanyDiscoveryService } from '../company-discovery-service.js';

const URL_ = 'https://93.184.216.34/careers';

function mockFetchOnce(html: string, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      text: async () => html,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CompanyDiscoveryService.discover — ATS fingerprint detection', () => {
  it('detects GREENHOUSE from a boards-api URL and resolves the jobs endpoint', async () => {
    mockFetchOnce(`<html><body><a href="https://boards-api.greenhouse.io/v1/boards/acme/jobs">jobs</a></body></html>`);

    const result = await new CompanyDiscoveryService().discover(URL_);

    expect(result.atsType).toBe('GREENHOUSE');
    expect(result.apiEndpoint).toBe('https://boards-api.greenhouse.io/v1/boards/acme/jobs');
    expect(result.metadata.boardToken).toBe('acme');
  });

  it('detects LEVER from an api.lever.co reference', async () => {
    mockFetchOnce(`<html>Jobs powered by <a href="https://api.lever.co/v0/postings/acme/senior-engineer">lever</a></html>`);

    const result = await new CompanyDiscoveryService().discover(URL_);

    expect(result.atsType).toBe('LEVER');
    expect(result.apiEndpoint).toBe('https://api.lever.co/v0/postings/acme');
  });

  it('detects ASHBY from a jobs.ashbyhq.com reference', async () => {
    mockFetchOnce(`<html><a href="https://jobs.ashbyhq.com/acme">careers</a></html>`);

    const result = await new CompanyDiscoveryService().discover(URL_);

    expect(result.atsType).toBe('ASHBY');
    expect(result.apiEndpoint).toBe('https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams');
  });

  it('falls back to JSON_LD when a JobPosting schema is present but no known ATS string matches', async () => {
    mockFetchOnce(
      `<html><script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script></html>`
    );

    const result = await new CompanyDiscoveryService().discover(URL_);

    expect(result.atsType).toBe('JSON_LD');
    expect(result.jsonLd).toEqual([{ '@type': 'JobPosting', title: 'Engineer' }]);
  });

  it('falls back to CUSTOM_HTML when nothing matches', async () => {
    mockFetchOnce(`<html><body>Come work with us!</body></html>`);

    const result = await new CompanyDiscoveryService().discover(URL_);

    expect(result.atsType).toBe('CUSTOM_HTML');
    expect(result.apiEndpoint).toBeNull();
  });

  it('extracts a careers page link relative to the origin', async () => {
    mockFetchOnce(`<html><a href="/careers/openings">Careers</a></html>`);

    const result = await new CompanyDiscoveryService().discover(URL_);

    expect(result.careerUrl).toBe('https://93.184.216.34/careers/openings');
  });

  it('returns a null-shaped result when the fetch fails (non-2xx)', async () => {
    mockFetchOnce('', false, 500);

    const result = await new CompanyDiscoveryService().discover(URL_);

    expect(result).toEqual({
      atsType: null,
      careerUrl: null,
      apiEndpoint: null,
      jsonLd: [],
      rss: null,
      sitemap: null,
      metadata: {},
    });
  });

  it('returns a null-shaped result for a URL blocked by SSRF protection (private address)', async () => {
    const result = await new CompanyDiscoveryService().discover('https://169.254.169.254/careers');

    expect(result.atsType).toBeNull();
    expect(result.careerUrl).toBeNull();
  });

  it('returns a null-shaped result when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unreachable')));

    const result = await new CompanyDiscoveryService().discover(URL_);

    expect(result.atsType).toBeNull();
  });
});

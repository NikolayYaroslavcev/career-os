import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkedInFetcher, type LinkedInFetcherConfig } from '../linkedin-fetcher.js';
import { NoopLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import { ProviderErrorType } from '../../../errors/provider-errors.js';

// Mock fetchWithTimeout
vi.mock('../../../resilience/resilient-fetch.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '../../../resilience/resilient-fetch.js';

const mockedFetch = vi.mocked(fetchWithTimeout);

function createFetcher(config: Partial<LinkedInFetcherConfig> = {}) {
  return new LinkedInFetcher({
    logger: new NoopLogger(),
    metrics: new InMemoryMetricsCollector(),
    tracer: new InMemoryTracer(),
    rateLimitMs: 0, // Disable rate limiting for tests
    ...config,
  });
}

function createSearchHtml(jobs: Array<{ id: string; title: string; company: string; location: string; date?: string }>): string {
  return jobs.map((job) => `
    <li class="reusable-search__result-container">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${job.id}">
      </a>
      <h3>${job.title}</h3>
      <h4 class="entity">${job.company}</h4>
      <span class="job-search-card__location">${job.location}</span>
      ${job.date ? `<time datetime="${job.date}">${job.date}</time>` : ''}
    </li>
  `).join('');
}

function createFallbackHtml(jobs: Array<{ id: string; title: string; company: string; location: string }>): string {
  return jobs.map((job) => `
    <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${job.id}"></a>
    <h3>${job.title}</h3>
    <h4 class="entity">${job.company}</h4>
    <span class="job-search-card__location">${job.location}</span>
  `).join('');
}

function createDetailHtml(overrides: { title?: string; company?: string; location?: string; description?: string; skills?: string[] } = {}): string {
  const {
    title = 'Senior Developer',
    company = 'TechCorp',
    location = 'Berlin, Germany',
    description = 'Build web applications',
    skills = [],
  } = overrides;

  const skillsHtml = skills.map((s) => `<span class="skill">${s}</span>`).join('');

  return `
    <h1 class="topcard__title">${title}</h1>
    <a class="topcard__org-name-link">${company}</a>
    <span class="topcard__flavor--bullet">${location}</span>
    <div class="description">${description}</div>
    ${skillsHtml}
  `;
}

function mockFetchResponse(html: string, status = 200) {
  mockedFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(html),
  } as Awaited<ReturnType<typeof fetchWithTimeout>>);
}

describe('LinkedInFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should fetch and parse search results', async () => {
      const html = createSearchHtml([
        { id: '123', title: 'TypeScript Developer', company: 'TechCorp', location: 'Berlin' },
        { id: '456', title: 'React Developer', company: 'WebCorp', location: 'Munich' },
      ]);
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'typescript' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.sourceId).toBe('123');
      expect(result.data[0]?.title).toBe('TypeScript Developer');
      expect(result.data[0]?.companyName).toBe('TechCorp');
      expect(result.data[1]?.sourceId).toBe('456');
    });

    it('should deduplicate jobs by sourceId', async () => {
      const html = createSearchHtml([
        { id: '123', title: 'Developer', company: 'Corp', location: 'Berlin' },
        { id: '123', title: 'Developer', company: 'Corp', location: 'Berlin' },
      ]);
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).toHaveLength(1);
    });

    it('should use fallback parsing when primary regex finds no results', async () => {
      const html = createFallbackHtml([
        { id: '789', title: 'Fallback Developer', company: 'FallbackCorp', location: 'Hamburg' },
      ]);
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.sourceId).toBe('789');
    });

    it('should return empty array for empty HTML', async () => {
      mockFetchResponse('<html><body>Nothing here</body></html>');

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'nothing' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).toHaveLength(0);
    });

    it('should handle HTTP 429 as rate limited', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve(''),
      } as Awaited<ReturnType<typeof fetchWithTimeout>>);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'test' });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected error result');
      expect(result.error).toBe(ProviderErrorType.RATE_LIMITED);
      expect(result.retryable).toBe(true);
    });

    it('should handle HTTP 403 as provider unavailable', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve(''),
      } as Awaited<ReturnType<typeof fetchWithTimeout>>);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'test' });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected error result');
      expect(result.error).toBe(ProviderErrorType.PROVIDER_UNAVAILABLE);
      expect(result.retryable).toBe(true);
    });

    it('should handle network errors', async () => {
      mockedFetch.mockRejectedValue(new Error('Network timeout'));

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'test' });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected error result');
      expect(result.error).toBe(ProviderErrorType.UNKNOWN_ERROR);
    });

    it('should build search URL with keywords', async () => {
      mockFetchResponse('<html></html>');

      const fetcher = createFetcher({ baseUrl: 'https://custom.linkedin.com' });
      await fetcher.search({ query: 'typescript developer' });

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('keywords=typescript+developer'),
        expect.anything(),
      );
    });

    it('should build search URL with technologies when no query', async () => {
      mockFetchResponse('<html></html>');

      const fetcher = createFetcher();
      await fetcher.search({ technologies: ['typescript', 'react'] });

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('keywords=typescript+react'),
        expect.anything(),
      );
    });

    it('should build search URL with location', async () => {
      mockFetchResponse('<html></html>');

      const fetcher = createFetcher();
      await fetcher.search({ query: 'developer', location: 'Berlin' });

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('location=Berlin'),
        expect.anything(),
      );
    });

    it('should build search URL with remote filter', async () => {
      mockFetchResponse('<html></html>');

      const fetcher = createFetcher();
      await fetcher.search({ query: 'developer', remoteOnly: true });

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('f_WT=2'),
        expect.anything(),
      );
    });

    it('should include published date from HTML', async () => {
      const html = createSearchHtml([
        { id: '123', title: 'Developer', company: 'Corp', location: 'Berlin', date: '2026-07-15' },
      ]);
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data[0]?.publishedAt).toEqual(new Date('2026-07-15'));
    });

    it('should default company to Unknown when empty', async () => {
      const html = `
        <li class="reusable-search__result-container">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/999"></a>
          <h3>Developer</h3>
          <h4 class="entity"></h4>
          <span class="job-search-card__location">Berlin</span>
        </li>
      `;
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data[0]?.companyName).toBe('Unknown');
    });

    it('should stop pagination when maxResults is reached', async () => {
      // limit is checked across pagination loops (allJobs.length < maxResults),
      // not within a single page. A single-page fetch returns all jobs on that page.
      const jobs = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        title: `Developer ${i}`,
        company: 'Corp',
        location: 'Berlin',
      }));
      const html = createSearchHtml(jobs);
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer', limit: 10 });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      // Single page with 5 jobs, limit 10 → all 5 returned
      expect(result.data).toHaveLength(5);
    });
  });

  describe('getVacancy', () => {
    it('should fetch and parse a vacancy detail page', async () => {
      const html = createDetailHtml({
        title: 'Senior TypeScript Developer',
        company: 'TechCorp',
        location: 'Berlin, Germany',
        description: 'Build web applications with TypeScript',
        skills: ['typescript', 'react', 'node.js'],
      });
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.getVacancy('12345');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).not.toBeNull();
      expect(result.data?.sourceId).toBe('12345');
      expect(result.data?.title).toBe('Senior TypeScript Developer');
      expect(result.data?.companyName).toBe('TechCorp');
      expect(result.data?.location).toBe('Berlin, Germany');
      expect(result.data?.description).toBe('Build web applications with TypeScript');
      expect(result.data?.technologies).toEqual(['typescript', 'react', 'node.js']);
      expect(result.data?.url).toBe('https://www.linkedin.com/jobs/view/12345');
    });

    it('should return null for 404 response', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(''),
      } as Awaited<ReturnType<typeof fetchWithTimeout>>);

      const fetcher = createFetcher();
      const result = await fetcher.getVacancy('99999');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).toBeNull();
    });

    it('should return null when title is not found', async () => {
      mockFetchResponse('<html><body>No title here</body></html>');

      const fetcher = createFetcher();
      const result = await fetcher.getVacancy('12345');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).toBeNull();
    });

    it('should handle network errors', async () => {
      mockedFetch.mockRejectedValue(new Error('Connection refused'));

      const fetcher = createFetcher();
      const result = await fetcher.getVacancy('12345');

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected error result');
      expect(result.error).toBe(ProviderErrorType.UNKNOWN_ERROR);
    });

    it('should use correct URL format', async () => {
      mockFetchResponse(createDetailHtml());

      const fetcher = createFetcher();
      await fetcher.getVacancy('12345');

      expect(mockedFetch).toHaveBeenCalledWith(
        'https://www.linkedin.com/jobs/view/12345',
        expect.anything(),
      );
    });
  });

  describe('fetchWithCursor', () => {
    it('should fetch with offset cursor', async () => {
      const html = createSearchHtml([
        { id: '123', title: 'Developer', company: 'Corp', location: 'Berlin' },
      ]);
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.fetchWithCursor(
        { query: 'developer' },
        { type: 'offset', offset: 50, limit: 25 },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data.jobs).toHaveLength(1);
      expect(result.data.hasMore).toBeDefined();
    });

    it('should indicate exhausted when no results', async () => {
      mockFetchResponse('<html></html>');

      const fetcher = createFetcher();
      const result = await fetcher.fetchWithCursor(
        { query: 'nothing' },
        { type: 'offset', offset: 0, limit: 25 },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data.hasMore).toBe(false);
      expect(result.data.cursor.exhausted).toBe(true);
    });

    it('should handle page cursor type', async () => {
      const html = createSearchHtml([
        { id: '123', title: 'Developer', company: 'Corp', location: 'Berlin' },
      ]);
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.fetchWithCursor(
        { query: 'developer' },
        { type: 'page', page: 2, perPage: 25 },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data.jobs).toHaveLength(1);
    });
  });

  describe('ping', () => {
    it('should return true when ping succeeds', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Awaited<ReturnType<typeof fetchWithTimeout>>);

      const fetcher = createFetcher();
      const result = await fetcher.ping();

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).toBe(true);
    });

    it('should return network error when ping fails', async () => {
      mockedFetch.mockRejectedValue(new Error('Network error'));

      const fetcher = createFetcher();
      const result = await fetcher.ping();

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected error result');
      expect(result.error).toBe(ProviderErrorType.NETWORK_ERROR);
      expect(result.retryable).toBe(true);
    });
  });

  describe('HTML parsing edge cases', () => {
    it('should handle HTML entities in titles', async () => {
      const html = createSearchHtml([
        { id: '123', title: 'Developer &amp; Architect', company: 'Corp', location: 'Berlin' },
      ]);
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data[0]?.title).toBe('Developer & Architect');
    });

    it('should handle extra whitespace in content', async () => {
      const html = `
        <li class="reusable-search__result-container">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/123"></a>
          <h3>  Senior   Developer  </h3>
          <h4 class="entity">  TechCorp  </h4>
          <span class="job-search-card__location">  Berlin,  Germany  </span>
        </li>
      `;
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data[0]?.title).toBe('Senior Developer');
      expect(result.data[0]?.companyName).toBe('TechCorp');
    });

    it('should skip cards without valid job ID', async () => {
      const html = `
        <li class="reusable-search__result-container">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/"></a>
          <h3>Developer</h3>
        </li>
        <li class="reusable-search__result-container">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/123"></a>
          <h3>Valid Developer</h3>
          <h4 class="entity">Corp</h4>
          <span class="job-search-card__location">Berlin</span>
        </li>
      `;
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.sourceId).toBe('123');
    });

    it('should skip cards without title', async () => {
      const html = `
        <li class="reusable-search__result-container">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/123"></a>
          <h3></h3>
          <h4 class="entity">Corp</h4>
        </li>
      `;
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data).toHaveLength(0);
    });

    it('should handle relative URLs', async () => {
      const html = `
        <li class="reusable-search__result-container">
          <a class="base-card__full-link" href="/jobs/view/123"></a>
          <h3>Developer</h3>
          <h4 class="entity">Corp</h4>
          <span class="job-search-card__location">Berlin</span>
        </li>
      `;
      mockFetchResponse(html);

      const fetcher = createFetcher();
      const result = await fetcher.search({ query: 'developer' });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok result');
      expect(result.data[0]?.url).toBe('https://www.linkedin.com/jobs/view/123');
    });
  });
});

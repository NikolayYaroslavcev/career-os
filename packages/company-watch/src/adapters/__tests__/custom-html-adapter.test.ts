import { describe, it, expect, vi, afterEach } from 'vitest';
import { CustomHtmlAdapter } from '../custom-html-adapter.js';
import type { AtsConfig } from '../base-adapter.js';

const CONFIG: AtsConfig = { careerUrl: 'https://example.com/careers/' };

function mockFetchOnce(html: string, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Internal Server Error',
      text: async () => html,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CustomHtmlAdapter (company-watch)', () => {
  const adapter = new CustomHtmlAdapter();

  it('has atsType CUSTOM_HTML', () => {
    expect(adapter.atsType).toBe('CUSTOM_HTML');
  });

  describe('baseline behavior (pre-existing, must keep working)', () => {
    it('extracts a job from a plain <a href> with a job-related keyword and plain-text title', async () => {
      mockFetchOnce(`<html><a href="/careers/123">Senior Engineer</a></html>`);

      const jobs = await adapter.fetchJobs(CONFIG);

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        title: 'Senior Engineer',
        url: 'https://example.com/careers/123',
      });
    });

    it('extracts jobs from JSON-LD JobPosting data', async () => {
      mockFetchOnce(
        `<html><script type="application/ld+json">{"@type":"JobPosting","title":"Data Analyst","url":"https://example.com/careers/456"}</script></html>`,
      );

      const jobs = await adapter.fetchJobs(CONFIG);

      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.title).toBe('Data Analyst');
    });

    it('dedupes a URL that appears in both the anchor scan and JSON-LD', async () => {
      mockFetchOnce(
        `<html>
           <a href="/careers/789">Product Manager</a>
           <script type="application/ld+json">{"@type":"JobPosting","title":"Product Manager","url":"/careers/789"}</script>
         </html>`,
      );

      const jobs = await adapter.fetchJobs(CONFIG);

      expect(jobs).toHaveLength(1);
    });

    it('filters out anchors whose cleaned title is too short (icon-only links, etc.)', async () => {
      mockFetchOnce(`<html><a href="/careers/1">Hi</a></html>`);

      const jobs = await adapter.fetchJobs(CONFIG);

      expect(jobs).toHaveLength(0);
    });

    it('throws when the careers page response is not ok', async () => {
      mockFetchOnce('', false, 500);

      await expect(adapter.fetchJobs(CONFIG)).rejects.toThrow('Failed to fetch careers page: 500');
    });

    it('ping returns true on an ok HEAD response and false on failure', async () => {
      mockFetchOnce('', true, 200);
      expect(await adapter.ping(CONFIG)).toBe(true);

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
      expect(await adapter.ping(CONFIG)).toBe(false);
    });
  });

  describe('regression fixes: real-world link patterns that were previously missed', () => {
    it('extracts the title when it is wrapped in nested markup inside the anchor (Comeet-style widget)', async () => {
      // Real pattern observed on a live Comeet-powered careers page: the
      // visible title sits in a child <div>, not as direct anchor text.
      mockFetchOnce(
        `<html><a class="comeet-position" href="/careers/co/x/staff-devops-engineer/all">
           <div class="comeet-position-name">Staff DevOps Engineer</div>
         </a></html>`,
      );

      const jobs = await adapter.fetchJobs(CONFIG);

      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.title).toBe('Staff DevOps Engineer');
      expect(jobs[0]?.url).toBe('https://example.com/careers/co/x/staff-devops-engineer/all');
    });

    it('resolves a path-relative href (no leading slash) against the full career page URL, not just the origin', async () => {
      const config: AtsConfig = { careerUrl: 'https://example.com/jobs/openings/' };
      mockFetchOnce(`<html><a href="job-123-senior-eng">Senior Engineer</a></html>`);

      const jobs = await adapter.fetchJobs(config);

      expect(jobs[0]?.url).toBe('https://example.com/jobs/openings/job-123-senior-eng');
    });

    it('still resolves a root-relative href (leading slash) to the origin root, unaffected by the page path', async () => {
      const config: AtsConfig = { careerUrl: 'https://example.com/jobs/openings/' };
      mockFetchOnce(`<html><a href="/careers/999">Staff Engineer</a></html>`);

      const jobs = await adapter.fetchJobs(config);

      expect(jobs[0]?.url).toBe('https://example.com/careers/999');
    });

    it('still resolves a protocol-relative href (//host/path) correctly', async () => {
      mockFetchOnce(`<html><a href="//example.com/careers/co/x/all">Backend Engineer</a></html>`);

      const jobs = await adapter.fetchJobs(CONFIG);

      expect(jobs[0]?.url).toBe('https://example.com/careers/co/x/all');
    });

    it('detects a job link via "vacancy"/"vacancies" in the href (common outside US English)', async () => {
      mockFetchOnce(`<html><a href="/vacancies/4521">Refunds Specialist</a></html>`);

      const jobs = await adapter.fetchJobs(CONFIG);

      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.title).toBe('Refunds Specialist');
    });

    it('detects a job link via "hiring" in the href, matching findCareersPage()\'s existing keyword set', async () => {
      mockFetchOnce(`<html><a href="/now-hiring/123">Warehouse Associate</a></html>`);

      const jobs = await adapter.fetchJobs(CONFIG);

      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.title).toBe('Warehouse Associate');
    });

    it('does not treat an unrelated "/vacation-policy" link as a job link (no false positive from the vacan substring)', async () => {
      mockFetchOnce(`<html><a href="/vacation-policy">Vacation Policy</a></html>`);

      const jobs = await adapter.fetchJobs(CONFIG);

      expect(jobs).toHaveLength(0);
    });
  });
});

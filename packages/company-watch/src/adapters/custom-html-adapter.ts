import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import { extractTechnologies } from './technology-keywords.js';

export class CustomHtmlAdapter implements AtsAdapter {
  readonly atsType = 'CUSTOM_HTML' as const;

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    const response = await fetch(config.careerUrl, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; CareerOS/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch careers page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseHtml(html, config.careerUrl);
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    const jobs = await this.fetchJobs(config);
    return jobs.find((j) => j.externalId === externalId) ?? null;
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      const response = await fetch(config.careerUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private parseHtml(html: string, baseUrl: string): AtsJob[] {
    const jobs: AtsJob[] = [];

    // Look for job links with common patterns
    const linkPatterns = [
      // Generic job listing links. Keyword list includes "vacan" (vacancy/
      // vacancies — common outside US English, seen on real CIS career
      // pages) and "hiring" (already used by CompanyDiscoveryService's own
      // findCareersPage() heuristic, previously missing here). The title
      // capture is `[\s\S]*?` rather than `[^<]+` because real ATS widgets
      // (e.g. Comeet) wrap the visible job title in a nested element
      // instead of putting it directly inside the <a> as plain text.
      /<a[^>]*href=["']([^"']*(?:job|position|role|opening|career|vacan|hiring)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
      // Greenhouse-style
      /<a[^>]*href=["'](https?:\/\/[^"']*greenhouse\.io[^"']*)["'][^>]*>([^<]+)<\/a>/gi,
      // Lever-style
      /<a[^>]*href=["'](https?:\/\/[^"']*lever\.co[^"']*)["'][^>]*>([^<]+)<\/a>/gi,
    ];

    const seen = new Set<string>();

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const [, url, title] = match;
        if (!url || !title || seen.has(url)) continue;

        // Strip any nested markup captured by the generic pattern above,
        // then clean up whitespace.
        const cleanTitle = title.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanTitle.length < 3 || cleanTitle.length > 200) continue;

        seen.add(url);
        jobs.push({
          externalId: this.generateId(url),
          title: cleanTitle,
          description: '',
          url: this.resolveUrl(url, baseUrl),
          technologies: [],
        });
      }
    }

    // Also look for structured data
    const jsonLdJobs = this.extractJsonLdJobs(html);
    for (const job of jsonLdJobs) {
      if (!seen.has(job.url)) {
        seen.add(job.url);
        jobs.push(job);
      }
    }

    return jobs;
  }

  private extractJsonLdJobs(html: string): AtsJob[] {
    const jobs: AtsJob[] = [];
    const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    let match;
    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const matchContent = match[1];
        if (!matchContent) continue;
        const data = JSON.parse(matchContent);
        if (data['@type'] === 'JobPosting') {
          jobs.push(this.mapJsonLdJob(data));
        } else if (Array.isArray(data)) {
          for (const item of data) {
            if (item['@type'] === 'JobPosting') {
              jobs.push(this.mapJsonLdJob(item));
            }
          }
        }
      } catch {
        // Skip invalid JSON-LD
      }
    }

    return jobs;
  }

  private mapJsonLdJob(data: Record<string, unknown>): AtsJob {
    const title = typeof data.title === 'string' ? data.title : 'Unknown Position';
    const description = typeof data.description === 'string' ? data.description : '';
    const url = typeof data.url === 'string' ? data.url : '';

    const location = data.jobLocation
      ? typeof data.jobLocation === 'object' && data.jobLocation !== null
        ? (data.jobLocation as Record<string, unknown>).address
          ? typeof (data.jobLocation as Record<string, unknown>).address === 'object'
            ? ((data.jobLocation as Record<string, unknown>).address as Record<string, unknown>).addressLocality
            : undefined
          : undefined
        : undefined
      : undefined;

    return {
      externalId: this.generateId(url),
      title,
      description,
      url,
      location: typeof location === 'string' ? location : undefined,
      technologies: extractTechnologies(description),
      publishedAt: typeof data.datePosted === 'string' ? new Date(data.datePosted) : undefined,
    };
  }

  private generateId(url: string): string {
    // Create a deterministic ID from the URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `html_${Math.abs(hash).toString(36)}`;
  }

  private resolveUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http')) return url;
    // Resolve against the full career page URL (not just its origin) so a
    // path-relative href (e.g. "123-senior-eng", no leading slash) on a
    // career page that itself lives under a path (e.g. /jobs/openings/)
    // resolves relative to that path instead of the site root.
    return new URL(url, baseUrl).toString();
  }
}

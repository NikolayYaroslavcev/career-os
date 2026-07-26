import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';

interface JsonLdJob {
  '@type': string;
  title: string;
  description: string;
  url: string;
  datePosted?: string;
  hiringOrganization?: { name: string };
  jobLocation?: {
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
  };
  employmentType?: string;
  validThrough?: string;
}

export class JsonLdAdapter implements AtsAdapter {
  readonly atsType = 'JSON_LD' as const;

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
    return this.parseJsonLd(html);
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

  private parseJsonLd(html: string): AtsJob[] {
    const jobs: AtsJob[] = [];
    const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    let match;
    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const matchContent = match[1];
        if (!matchContent) continue;
        const data = JSON.parse(matchContent);
        if (data['@type'] === 'JobPosting') {
          jobs.push(this.mapJob(data));
        } else if (Array.isArray(data)) {
          for (const item of data) {
            if (item['@type'] === 'JobPosting') {
              jobs.push(this.mapJob(item));
            }
          }
        } else if (data['@graph']) {
          for (const item of data['@graph']) {
            if (item['@type'] === 'JobPosting') {
              jobs.push(this.mapJob(item));
            }
          }
        }
      } catch {
        // Skip invalid JSON-LD
      }
    }

    return jobs;
  }

  private mapJob(data: JsonLdJob): AtsJob {
    const title = data.title || 'Unknown Position';
    const description = data.description || '';
    const url = data.url || '';

    const location = data.jobLocation?.address
      ? [
          data.jobLocation.address.addressLocality,
          data.jobLocation.address.addressRegion,
          data.jobLocation.address.addressCountry,
        ]
          .filter(Boolean)
          .join(', ')
      : undefined;

    return {
      externalId: this.generateId(url),
      title,
      description: this.htmlToText(description),
      url,
      location,
      technologies: this.extractTechnologies(description),
      publishedAt: data.datePosted ? new Date(data.datePosted) : undefined,
    };
  }

  private generateId(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `jsonld_${Math.abs(hash).toString(36)}`;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTechnologies(description: string): string[] {
    const techPatterns = [
      /typescript|javascript|python|java|golang|go|rust|ruby|php|c\+\+|c#|swift|kotlin/i,
      /react|vue|angular|svelte|next\.?js|nuxt/i,
      /node\.?js|deno|bun/i,
      /aws|gcp|azure|docker|kubernetes|k8s/i,
      /postgresql|mysql|mongodb|redis|elasticsearch/i,
    ];

    const technologies: string[] = [];
    for (const pattern of techPatterns) {
      const matches = description.match(pattern);
      if (matches) {
        technologies.push(...matches.map((m) => m.toLowerCase()));
      }
    }

    return [...new Set(technologies)];
  }
}

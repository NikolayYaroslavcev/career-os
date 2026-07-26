import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';

interface LeverJob {
  id: string;
  text: string;
  description: string;
  descriptionHtml: string;
  hostedUrl: string;
  createdAt: number;
  updatedAt: number;
  categories: {
    team?: string;
    department?: string;
    location?: string;
  };
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

export class LeverAdapter implements AtsAdapter {
  readonly atsType = 'LEVER' as const;

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    const url = this.buildUrl(config);
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as LeverJob[];
    return data.map((job) => this.mapJob(job));
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    const url = `${this.buildBaseUrl(config)}/${externalId}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status} ${response.statusText}`);
    }

    const job = (await response.json()) as LeverJob;
    return this.mapJob(job);
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      const url = this.buildUrl(config);
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildUrl(config: AtsConfig): string {
    return `${this.buildBaseUrl(config)}`;
  }

  private buildBaseUrl(config: AtsConfig): string {
    const metadata = config.metadata as { company?: string } | undefined;
    const company = metadata?.company;
    if (!company) {
      throw new Error('Lever adapter requires company in metadata');
    }
    return `https://api.lever.co/v0/postings/${company}`;
  }

  private mapJob(job: LeverJob): AtsJob {
    return {
      externalId: job.id,
      title: job.text,
      description: job.descriptionHtml || job.description || '',
      url: job.hostedUrl,
      location: job.categories?.location,
      salary: job.salary ? {
        min: job.salary.min,
        max: job.salary.max,
        currency: job.salary.currency || 'USD',
      } : undefined,
      technologies: this.extractTechnologies(job.description),
      publishedAt: new Date(job.createdAt),
      departments: [
        job.categories?.department,
        job.categories?.team,
      ].filter(Boolean) as string[],
    };
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

import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';

interface WorkdayJob {
  bulletFields: string[];
  externalPath: string;
  locationsText: string;
  postedOn: string;
  title: string;
}

interface WorkdayResponse {
  jobPostings: WorkdayJob[];
  total: number;
  facets: unknown[];
}

export class WorkdayAdapter implements AtsAdapter {
  readonly atsType = 'WORKDAY' as const;

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    const jobs: AtsJob[] = [];
    let offset = 0;
    const limit = 20;
    let hasMore = true;

    while (hasMore) {
      const url = this.buildUrl(config);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit,
          offset,
          searchText: '',
        }),
      });

      if (!response.ok) {
        throw new Error(`Workday API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as WorkdayResponse;
      jobs.push(...data.jobPostings.map((job) => this.mapJob(job, config)));

      hasMore = offset + limit < data.total;
      offset += limit;
    }

    return jobs;
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    const baseUrl = this.buildBaseUrl(config);
    const url = `${baseUrl}/${externalId}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Workday API error: ${response.status} ${response.statusText}`);
    }

    const job = (await response.json()) as WorkdayJob;
    return this.mapJob(job, config);
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      const url = this.buildUrl(config);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: 1,
          offset: 0,
          searchText: '',
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildUrl(config: AtsConfig): string {
    const baseUrl = this.buildBaseUrl(config);
    return `${baseUrl}/jobs`;
  }

  private buildBaseUrl(config: AtsConfig): string {
    const metadata = config.metadata as { tenant?: string; site?: string } | undefined;
    const tenant = metadata?.tenant;
    const site = metadata?.site;
    if (!tenant || !site) {
      throw new Error('Workday adapter requires tenant and site in metadata');
    }
    return `https://${tenant}.wd${site}.myworkdayjobs.com/wday/cxs/${tenant}/${site}`;
  }

  private mapJob(job: WorkdayJob, config: AtsConfig): AtsJob {
    const metadata = config.metadata as { tenant?: string; site?: string } | undefined;
    const tenant = metadata?.tenant;
    const site = metadata?.site;

    return {
      externalId: job.externalPath,
      title: job.title,
      description: job.bulletFields?.join('\n') || '',
      url: `https://${tenant}.wd${site}.myworkdayjobs.com${job.externalPath}`,
      location: job.locationsText,
      technologies: this.extractTechnologies(job.bulletFields?.join(' ') || ''),
      publishedAt: job.postedOn ? new Date(job.postedOn) : undefined,
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

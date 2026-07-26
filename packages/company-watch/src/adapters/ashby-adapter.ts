import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';

interface AshbyJob {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string;
  locationName: string;
  employmentType: string;
  departmentName: string;
  teamName: string;
  isRemote: boolean;
  publishedAt: string;
  sortOrder: number;
}

interface AshbyResponse {
  data: {
    jobBoard: {
      name: string;
      departments: {
        id: string;
        name: string;
        teams: {
          id: string;
          name: string;
          jobs: AshbyJob[];
        }[];
      }[];
    };
  };
}

export class AshbyAdapter implements AtsAdapter {
  readonly atsType = 'ASHBY' as const;

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    const url = this.buildUrl(config);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operationName: 'ApiJobBoardWithTeams',
        variables: {},
        query: `query ApiJobBoardWithTeams { jobBoard { name departments { id name teams { id name jobs { id title description descriptionHtml locationName employmentType departmentName teamName isRemote publishedAt sortOrder } } } }`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ashby API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as AshbyResponse;
    const jobs: AtsJob[] = [];

    for (const dept of data.data.jobBoard.departments) {
      for (const team of dept.teams) {
        for (const job of team.jobs) {
          jobs.push(this.mapJob(job));
        }
      }
    }

    return jobs;
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    const jobs = await this.fetchJobs(config);
    return jobs.find((j) => j.externalId === externalId) ?? null;
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
          operationName: 'ApiJobBoardWithTeams',
          variables: {},
          query: `query ApiJobBoardWithTeams { jobBoard { name } }`,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildUrl(config: AtsConfig): string {
    const metadata = config.metadata as { jobBoardName?: string } | undefined;
    const jobBoardName = metadata?.jobBoardName;
    if (!jobBoardName) {
      throw new Error('Ashby adapter requires jobBoardName in metadata');
    }
    return `https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams`;
  }

  private mapJob(job: AshbyJob): AtsJob {
    return {
      externalId: job.id,
      title: job.title,
      description: job.descriptionHtml || job.description || '',
      url: `https://jobs.ashbyhq.com/${job.id}`,
      location: job.locationName,
      technologies: this.extractTechnologies(job.description),
      publishedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
      departments: [job.departmentName, job.teamName].filter(Boolean),
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

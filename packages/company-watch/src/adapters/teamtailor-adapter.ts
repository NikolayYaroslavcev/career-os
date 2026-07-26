import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';

interface TeamtailorJob {
  id: string;
  type: string;
  attributes: {
    title: string;
    description: string;
    'description-html': string;
    location: string;
    'remote': boolean;
    'pitch': string;
    'published-at': string;
    'created-at': string;
    'updated-at': string;
  };
  relationships: {
    department?: { data?: { id: string } };
    role?: { data?: { id: string } };
  };
}

interface TeamtailorResponse {
  data: TeamtailorJob[];
  included?: {
    departments?: { id: string; attributes: { name: string } }[];
    roles?: { id: string; attributes: { name: string } }[];
  };
}

export class TeamtailorAdapter implements AtsAdapter {
  readonly atsType = 'TEAMTAILOR' as const;

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    const url = this.buildUrl(config);
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.api+json',
        'X-Api-Key': this.getApiKey(config),
      },
    });

    if (!response.ok) {
      throw new Error(`Teamtailor API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TeamtailorResponse;
    return data.data.map((job) => this.mapJob(job, data.included));
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    const baseUrl = this.buildBaseUrl(config);
    const url = `${baseUrl}/jobs/${externalId}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.api+json',
        'X-Api-Key': this.getApiKey(config),
      },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Teamtailor API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { data: TeamtailorJob; included?: TeamtailorResponse['included'] };
    return this.mapJob(data.data, data.included);
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      const url = `${this.buildBaseUrl(config)}/jobs?page[size]=1`;
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          Accept: 'application/vnd.api+json',
          'X-Api-Key': this.getApiKey(config),
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildUrl(config: AtsConfig): string {
    return `${this.buildBaseUrl(config)}/jobs`;
  }

  private buildBaseUrl(_config: AtsConfig): string {
    return 'https://api.teamtailor.com/v1';
  }

  private getApiKey(config: AtsConfig): string {
    const metadata = config.metadata as { apiKey?: string } | undefined;
    const apiKey = metadata?.apiKey;
    if (!apiKey) {
      throw new Error('Teamtailor adapter requires apiKey in metadata');
    }
    return apiKey;
  }

  private mapJob(job: TeamtailorJob, included?: TeamtailorResponse['included']): AtsJob {
    const departmentId = job.relationships.department?.data?.id;
    const department = departmentId
      ? included?.departments?.find((d) => d.id === departmentId)?.attributes.name
      : undefined;

    const roleId = job.relationships.role?.data?.id;
    const role = roleId
      ? included?.roles?.find((r) => r.id === roleId)?.attributes.name
      : undefined;

    return {
      externalId: job.id,
      title: job.attributes.title,
      description: job.attributes['description-html'] || job.attributes.description || '',
      url: `https://jobs.teamtailor.com/jobs/${job.id}`,
      location: job.attributes.location,
      technologies: this.extractTechnologies(job.attributes.description),
      publishedAt: job.attributes['published-at'] ? new Date(job.attributes['published-at']) : undefined,
      departments: [department, role].filter(Boolean) as string[],
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

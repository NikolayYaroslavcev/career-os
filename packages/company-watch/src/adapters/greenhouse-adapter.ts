import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  content: string;
  location: { name: string };
  departments?: { id: number; name: string }[];
  metadata?: { id: number; name: string; value: string | null }[];
  pay_input_ranges?: { min_cents: number | null; max_cents: number | null; currency_type: string | null }[];
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export class GreenhouseAdapter implements AtsAdapter {
  readonly atsType = 'GREENHOUSE' as const;

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    const url = this.buildUrl(config);
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Greenhouse API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GreenhouseResponse;
    return data.jobs.map((job) => this.mapJob(job));
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    const url = `${this.buildBaseUrl(config)}/jobs/${externalId}?questions=false`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Greenhouse API error: ${response.status} ${response.statusText}`);
    }

    const job = (await response.json()) as GreenhouseJob;
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
    const baseUrl = this.buildBaseUrl(config);
    return `${baseUrl}/jobs?content=true`;
  }

  private buildBaseUrl(config: AtsConfig): string {
    const metadata = config.metadata as { boardToken?: string } | undefined;
    const boardToken = metadata?.boardToken;
    if (!boardToken) {
      throw new Error('Greenhouse adapter requires boardToken in metadata');
    }
    return `https://boards-api.greenhouse.io/v1/boards/${boardToken}`;
  }

  private mapJob(job: GreenhouseJob): AtsJob {
    return {
      externalId: String(job.id),
      title: job.title,
      description: job.content || '',
      url: job.absolute_url,
      location: job.location?.name,
      salary: this.parseSalary(job.pay_input_ranges),
      technologies: this.extractTechnologies(job.metadata),
      publishedAt: new Date(job.updated_at),
      departments: job.departments?.map((d) => d.name),
    };
  }

  private parseSalary(ranges: GreenhouseJob['pay_input_ranges']): AtsJob['salary'] | undefined {
    const range = ranges?.[0];
    if (!range || (range.min_cents == null && range.max_cents == null)) {
      return undefined;
    }

    return {
      min: range.min_cents != null ? range.min_cents / 100 : undefined,
      max: range.max_cents != null ? range.max_cents / 100 : undefined,
      currency: range.currency_type ?? 'USD',
    };
  }

  private extractTechnologies(metadata: GreenhouseJob['metadata']): string[] {
    if (!metadata) return [];

    const techFields = metadata.filter((field) => /tech(nolog(y|ies))?|skills?/i.test(field.name));
    const technologies: string[] = [];

    for (const field of techFields) {
      if (!field.value) continue;
      technologies.push(...field.value.split(',').map((t) => t.trim()).filter(Boolean));
    }

    return technologies;
  }
}

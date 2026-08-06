import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import {
  GreenhouseAdapter as SharedGreenhouseAdapter,
  AtsHttpError,
  type AtsRawJob,
  type GreenhouseAdapterConfig,
  type GreenhouseMetadataFieldPayload,
} from '@careeros/ats-adapters';

export class GreenhouseAdapter implements AtsAdapter {
  readonly atsType = 'GREENHOUSE' as const;
  private readonly adapter = new SharedGreenhouseAdapter();

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    try {
      const jobs = await this.adapter.fetchJobs(this.toAdapterConfig(config));
      return jobs.map((job) => this.toAtsJob(job));
    } catch (error) {
      throw toGreenhouseError(error);
    }
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    try {
      const job = await this.adapter.fetchJob(this.toAdapterConfig(config), externalId);
      return job ? this.toAtsJob(job) : null;
    } catch (error) {
      throw toGreenhouseError(error);
    }
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      return await this.adapter.ping(this.toAdapterConfig(config));
    } catch {
      return false;
    }
  }

  private toAdapterConfig(config: AtsConfig): GreenhouseAdapterConfig {
    const metadata = config.metadata as { boardToken?: string } | undefined;
    const boardToken = metadata?.boardToken;
    if (!boardToken) {
      throw new Error('Greenhouse adapter requires boardToken in metadata');
    }
    return { boardToken };
  }

  private toAtsJob(job: AtsRawJob): AtsJob {
    return {
      externalId: job.externalId,
      title: job.title,
      description: job.description,
      url: job.url,
      location: job.location,
      salary: job.salary,
      technologies: extractTechnologies(job.rawMetadata as readonly GreenhouseMetadataFieldPayload[] | null | undefined),
      publishedAt: job.publishedAt,
      departments: job.departments ? [...job.departments] : undefined,
    };
  }
}

/** Preserves this adapter's original thrown-error message format at the boundary (ADR-033: adapters throw typed errors; consumers compose their own message). */
function toGreenhouseError(error: unknown): Error {
  if (error instanceof AtsHttpError) {
    return new Error(`Greenhouse API error: ${error.status} ${error.statusText}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** Consumer-owned: technology enrichment stays out of the shared canonical model (ADR-033). */
function extractTechnologies(metadata: readonly GreenhouseMetadataFieldPayload[] | null | undefined): string[] {
  if (!metadata) return [];

  const techFields = metadata.filter((field) => /tech(nolog(y|ies))?|skills?/i.test(field.name));
  const technologies: string[] = [];

  for (const field of techFields) {
    if (!field.value) continue;
    technologies.push(...field.value.split(',').map((t) => t.trim()).filter(Boolean));
  }

  return technologies;
}

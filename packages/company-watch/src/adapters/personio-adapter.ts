import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import { extractTechnologies } from './technology-keywords.js';
import {
  PersonioAdapter as SharedPersonioAdapter,
  AtsHttpError,
  type AtsRawJob,
  type PersonioAdapterConfig,
  type PersonioPositionPayload,
} from '@careeros/ats-adapters';

/**
 * ADR-033 addendum: Personio migration (research/free-provider-expansion
 * EPIC.md Phase 1). Closes the `PERSONIO` gap `AtsType` already declared
 * (see REPORT.md §2.3) — this is the first adapter for it, not a
 * replacement of prior company-watch code.
 */
export class PersonioAdapter implements AtsAdapter {
  readonly atsType = 'PERSONIO' as const;
  private readonly adapter = new SharedPersonioAdapter();

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    try {
      const jobs = await this.adapter.fetchJobs(this.toAdapterConfig(config));
      return jobs.map((job) => this.toAtsJob(job));
    } catch (error) {
      throw toPersonioError(error);
    }
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    try {
      const job = await this.adapter.fetchJob(this.toAdapterConfig(config), externalId);
      return job ? this.toAtsJob(job) : null;
    } catch (error) {
      throw toPersonioError(error);
    }
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      return await this.adapter.ping(this.toAdapterConfig(config));
    } catch {
      return false;
    }
  }

  private toAdapterConfig(config: AtsConfig): PersonioAdapterConfig {
    const metadata = config.metadata as { company?: string; language?: string } | undefined;
    const company = metadata?.company;
    if (!company) {
      throw new Error('Personio adapter requires company in metadata');
    }
    return { company, language: metadata?.language };
  }

  private toAtsJob(job: AtsRawJob): AtsJob {
    const raw = job.rawMetadata as PersonioPositionPayload;
    return {
      externalId: job.externalId,
      title: job.title,
      description: job.description,
      url: job.url,
      location: job.location,
      technologies: extractTechnologies(`${raw.keywords ?? ''} ${job.description}`),
      publishedAt: job.publishedAt,
      departments: job.departments ? [...job.departments] : undefined,
    };
  }
}

/** Preserves this adapter's own thrown-error message format at the boundary (ADR-033: adapters throw typed errors; consumers compose their own message). */
function toPersonioError(error: unknown): Error {
  if (error instanceof AtsHttpError) {
    return new Error(`Personio API error: ${error.status} ${error.statusText}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

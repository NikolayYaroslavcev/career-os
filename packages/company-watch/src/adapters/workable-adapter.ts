import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import { extractTechnologies } from './technology-keywords.js';
import {
  WorkableAdapter as SharedWorkableAdapter,
  AtsHttpError,
  type AtsRawJob,
} from '@careeros/ats-adapters';

/**
 * ADR-033 addendum: Workable migration (research/free-provider-expansion
 * EPIC.md Phase 1). First adapter for `WORKABLE` — closes the SMB/mid-market
 * ATS-coverage gap flagged in REPORT.md §4.1.
 */
export class WorkableAdapter implements AtsAdapter {
  readonly atsType = 'WORKABLE' as const;
  private readonly adapter = new SharedWorkableAdapter();

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    try {
      const jobs = await this.adapter.fetchJobs(this.toAdapterConfig(config));
      return jobs.map((job) => this.toAtsJob(job));
    } catch (error) {
      throw toWorkableError(error);
    }
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    try {
      const job = await this.adapter.fetchJob(this.toAdapterConfig(config), externalId);
      return job ? this.toAtsJob(job) : null;
    } catch (error) {
      throw toWorkableError(error);
    }
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      return await this.adapter.ping(this.toAdapterConfig(config));
    } catch {
      return false;
    }
  }

  private toAdapterConfig(config: AtsConfig): { accountSlug: string } {
    const metadata = config.metadata as { accountSlug?: string } | undefined;
    const accountSlug = metadata?.accountSlug;
    if (!accountSlug) {
      throw new Error('Workable adapter requires accountSlug in metadata');
    }
    return { accountSlug };
  }

  private toAtsJob(job: AtsRawJob): AtsJob {
    return {
      externalId: job.externalId,
      title: job.title,
      description: job.description,
      url: job.url,
      location: job.location,
      technologies: extractTechnologies(job.description),
      publishedAt: job.publishedAt,
      departments: job.departments ? [...job.departments] : undefined,
    };
  }
}

/** Preserves this adapter's own thrown-error message format at the boundary (ADR-033: adapters throw typed errors; consumers compose their own message). */
function toWorkableError(error: unknown): Error {
  if (error instanceof AtsHttpError) {
    return new Error(`Workable API error: ${error.status} ${error.statusText}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

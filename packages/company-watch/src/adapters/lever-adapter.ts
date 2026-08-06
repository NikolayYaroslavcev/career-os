import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import { extractTechnologies } from './technology-keywords.js';
import {
  LeverAdapter as SharedLeverAdapter,
  AtsHttpError,
  type AtsRawJob,
  type LeverAdapterConfig,
  type LeverPostingPayload,
} from '@careeros/ats-adapters';

export class LeverAdapter implements AtsAdapter {
  readonly atsType = 'LEVER' as const;
  private readonly adapter = new SharedLeverAdapter();

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    try {
      const jobs = await this.adapter.fetchJobs(this.toAdapterConfig(config));
      return jobs.map((job) => this.toAtsJob(job));
    } catch (error) {
      throw toLeverError(error);
    }
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    try {
      const job = await this.adapter.fetchJob(this.toAdapterConfig(config), externalId);
      return job ? this.toAtsJob(job) : null;
    } catch (error) {
      throw toLeverError(error);
    }
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      return await this.adapter.ping(this.toAdapterConfig(config));
    } catch {
      return false;
    }
  }

  private toAdapterConfig(config: AtsConfig): LeverAdapterConfig {
    const metadata = config.metadata as { company?: string } | undefined;
    const company = metadata?.company;
    if (!company) {
      throw new Error('Lever adapter requires company in metadata');
    }
    return { company };
  }

  private toAtsJob(job: AtsRawJob): AtsJob {
    const raw = job.rawMetadata as LeverPostingPayload | undefined;
    return {
      externalId: job.externalId,
      title: job.title,
      description: job.description,
      url: job.url,
      location: job.location,
      // Original code read `job.salary` here, a field that does not exist on
      // real Lever postings (the real field is `salaryRange`, which providers'
      // fetcher already reads correctly) — so this has always evaluated to
      // undefined in production. Preserved as-is rather than "fixed" here; see
      // ADR-033 addendum "Lever migration parity" for the full trace.
      salary: undefined,
      technologies: extractTechnologies(job.description),
      publishedAt: job.publishedAt,
      departments: [raw?.categories?.department, raw?.categories?.team].filter(Boolean) as string[],
    };
  }
}

/** Preserves this adapter's original thrown-error message format at the boundary (ADR-033: adapters throw typed errors; consumers compose their own message). */
function toLeverError(error: unknown): Error {
  if (error instanceof AtsHttpError) {
    return new Error(`Lever API error: ${error.status} ${error.statusText}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

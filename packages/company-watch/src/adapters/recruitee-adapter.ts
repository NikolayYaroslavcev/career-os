import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import { extractTechnologies } from './technology-keywords.js';
import {
  RecruiteeAdapter as SharedRecruiteeAdapter,
  AtsHttpError,
  type AtsRawJob,
  type RecruiteeAdapterConfig,
  type RecruiteeOfferPayload,
} from '@careeros/ats-adapters';

/**
 * Closes the ADR-033 "concrete gap": `AtsType` already declared `RECRUITEE`,
 * but no adapter existed here — `AtsAdapterRegistry.get()` threw for any
 * `CompanyWatch` row of this type. `packages/providers` already had a full
 * Fetcher/Mapper/Normalizer stack, so this wrapper is new (not a migration of
 * pre-existing company-watch code, unlike Greenhouse/Lever) — it delegates
 * wholesale to the shared `RecruiteeAdapter`, same pattern as
 * `SmartRecruitersAdapter`.
 */
export class RecruiteeAdapter implements AtsAdapter {
  readonly atsType = 'RECRUITEE' as const;
  private readonly adapter = new SharedRecruiteeAdapter();

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    try {
      const jobs = await this.adapter.fetchJobs(this.toAdapterConfig(config));
      return jobs.map((job) => this.toAtsJob(job));
    } catch (error) {
      throw toRecruiteeError(error);
    }
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    try {
      const job = await this.adapter.fetchJob(this.toAdapterConfig(config), externalId);
      return job ? this.toAtsJob(job) : null;
    } catch (error) {
      throw toRecruiteeError(error);
    }
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      return await this.adapter.ping(this.toAdapterConfig(config));
    } catch {
      return false;
    }
  }

  private toAdapterConfig(config: AtsConfig): RecruiteeAdapterConfig {
    const metadata = config.metadata as { company?: string } | undefined;
    const company = metadata?.company;
    if (!company) {
      throw new Error('Recruitee adapter requires company in metadata');
    }
    return { company };
  }

  private toAtsJob(job: AtsRawJob): AtsJob {
    const raw = job.rawMetadata as RecruiteeOfferPayload | undefined;
    return {
      externalId: job.externalId,
      title: job.title,
      description: job.description,
      url: job.url,
      location: job.location,
      salary: job.salary,
      technologies: extractTechnologies(job.description),
      publishedAt: job.publishedAt,
      departments: [raw?.department, raw?.team].filter(Boolean) as string[],
    };
  }
}

/** Preserves this adapter's own thrown-error message format at the boundary (ADR-033: adapters throw typed errors; consumers compose their own message). */
function toRecruiteeError(error: unknown): Error {
  if (error instanceof AtsHttpError) {
    return new Error(`Recruitee API error: ${error.status} ${error.statusText}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

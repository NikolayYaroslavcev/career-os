import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import { extractTechnologies } from './technology-keywords.js';
import {
  SmartRecruitersAdapter as SharedSmartRecruitersAdapter,
  AtsHttpError,
  type AtsRawJob,
  type SmartRecruitersAdapterConfig,
} from '@careeros/ats-adapters';

/**
 * Closes the ADR-033 "concrete gap": `AtsType` already declared
 * `SMARTRECRUITERS`, but no adapter existed here — `AtsAdapterRegistry.get()`
 * threw for any `CompanyWatch` row of this type. `packages/providers` already
 * had a full Fetcher/Mapper/Normalizer stack, so this wrapper is new (not a
 * migration of pre-existing company-watch code, unlike Greenhouse/Lever) —
 * it delegates wholesale to the shared `SmartRecruitersAdapter`, same pattern
 * as `GreenhouseAdapter`.
 */
export class SmartRecruitersAdapter implements AtsAdapter {
  readonly atsType = 'SMARTRECRUITERS' as const;
  private readonly adapter = new SharedSmartRecruitersAdapter();

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    try {
      const jobs = await this.adapter.fetchJobs(this.toAdapterConfig(config));
      return jobs.map((job) => this.toAtsJob(job));
    } catch (error) {
      throw toSmartRecruitersError(error);
    }
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    try {
      const job = await this.adapter.fetchJob(this.toAdapterConfig(config), externalId);
      return job ? this.toAtsJob(job) : null;
    } catch (error) {
      throw toSmartRecruitersError(error);
    }
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      return await this.adapter.ping(this.toAdapterConfig(config));
    } catch {
      return false;
    }
  }

  private toAdapterConfig(config: AtsConfig): SmartRecruitersAdapterConfig {
    const metadata = config.metadata as { company?: string } | undefined;
    const company = metadata?.company;
    if (!company) {
      throw new Error('SmartRecruiters adapter requires company in metadata');
    }
    return { company };
  }

  private toAtsJob(job: AtsRawJob): AtsJob {
    return {
      externalId: job.externalId,
      title: job.title,
      description: job.description,
      url: job.url,
      location: job.location,
      salary: job.salary,
      technologies: extractTechnologies(job.description),
      publishedAt: job.publishedAt,
      departments: job.departments ? [...job.departments] : undefined,
    };
  }
}

/** Preserves this adapter's own thrown-error message format at the boundary (ADR-033: adapters throw typed errors; consumers compose their own message). */
function toSmartRecruitersError(error: unknown): Error {
  if (error instanceof AtsHttpError) {
    return new Error(`SmartRecruiters API error: ${error.status} ${error.statusText}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import { extractTechnologies } from './technology-keywords.js';
import {
  AshbyAdapter as SharedAshbyAdapter,
  AtsHttpError,
  type AtsRawJob,
  type AshbyAdapterConfig,
  type AshbyJobPayload,
} from '@careeros/ats-adapters';

/**
 * ADR-033 Ashby migration: this **replaces**, rather than diffs against, the
 * prior company-watch `AshbyAdapter`. That implementation called an
 * undocumented GraphQL endpoint (`jobs.ashbyhq.com/api/non-user-graphql`)
 * with an empty `variables: {}` — it never embedded the required
 * `jobBoardName` in the request at all, so it could not have correctly
 * selected a specific company's board for any workspace watching more than
 * one Ashby-hosted company. It also had zero test coverage
 * (`ashby-adapter.test.ts` did not exist before this migration), unlike
 * Greenhouse/Lever/SmartRecruiters, which all had passing tests proving
 * their prior behavior before migration.
 *
 * Because the old behavior was not "different but working" (compare Lever's
 * genuinely-functional paginated-vs-bare URL split, which this migration
 * preserved as two distinct transport shapes), there was nothing worth
 * preserving here. This wrapper instead delegates to the same documented
 * REST Job Board API providers' `AshbyFetcher` already used successfully —
 * the first time company-watch's Ashby integration can actually select a
 * per-workspace board. This is a deliberate, called-out behavior change, not
 * a silent bugfix.
 */
export class AshbyAdapter implements AtsAdapter {
  readonly atsType = 'ASHBY' as const;
  private readonly adapter = new SharedAshbyAdapter();

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    try {
      const jobs = await this.adapter.fetchJobs(this.toAdapterConfig(config));
      return jobs.map((job) => this.toAtsJob(job));
    } catch (error) {
      throw toAshbyError(error);
    }
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    try {
      const job = await this.adapter.fetchJob(this.toAdapterConfig(config), externalId);
      return job ? this.toAtsJob(job) : null;
    } catch (error) {
      throw toAshbyError(error);
    }
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      return await this.adapter.ping(this.toAdapterConfig(config));
    } catch {
      return false;
    }
  }

  private toAdapterConfig(config: AtsConfig): AshbyAdapterConfig {
    const metadata = config.metadata as { jobBoardName?: string } | undefined;
    const jobBoardName = metadata?.jobBoardName;
    if (!jobBoardName) {
      throw new Error('Ashby adapter requires jobBoardName in metadata');
    }
    return { jobBoardName };
  }

  private toAtsJob(job: AtsRawJob): AtsJob {
    const raw = job.rawMetadata as AshbyJobPayload;
    return {
      externalId: job.externalId,
      title: job.title,
      description: job.description,
      url: job.url,
      location: job.location,
      technologies: extractTechnologies(job.description),
      publishedAt: job.publishedAt,
      departments: [raw.departmentName, raw.teamName].filter((v): v is string => Boolean(v)),
    };
  }
}

/** Preserves this adapter's own thrown-error message format at the boundary (ADR-033: adapters throw typed errors; consumers compose their own message). */
function toAshbyError(error: unknown): Error {
  if (error instanceof AtsHttpError) {
    return new Error(`Ashby API error: ${error.status} ${error.statusText}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

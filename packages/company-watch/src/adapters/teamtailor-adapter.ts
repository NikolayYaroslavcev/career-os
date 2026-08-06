import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import { extractTechnologies } from './technology-keywords.js';
import {
  TeamtailorAdapter as SharedTeamtailorAdapter,
  AtsHttpError,
  type AtsRawJob,
  type TeamtailorAdapterConfig,
} from '@careeros/ats-adapters';

/**
 * ADR-033 Teamtailor migration: this **replaces**, rather than diffs
 * against, the prior company-watch `TeamtailorAdapter`. That implementation
 * authenticated with an `X-Api-Key` header — not a header Teamtailor's real
 * API documents or recognizes (the actual scheme is `Authorization: Token
 * token=...` plus `X-Api-Version`, confirmed by providers' fetcher and its
 * passing tests). It also read job fields under names that don't exist on
 * the real Teamtailor Job resource (`description`/`description-html` instead
 * of `body`/`pitch`; `remote` instead of `remote-status`) and hardcoded a
 * career-site URL pattern (`jobs.teamtailor.com/jobs/{id}`) instead of using
 * the real `careersite-job-url` link Teamtailor's API actually returns. It
 * had zero test coverage. See ADR-033 addendum "Teamtailor migration".
 *
 * Its `included`-relationship resolution for department/role *was* the
 * right JSON:API pattern — just built on the wrong request. The shared
 * adapter now does that resolution correctly (see `teamtailor-parser.ts`),
 * so `departments` here is a real capability, not a placeholder.
 */
export class TeamtailorAdapter implements AtsAdapter {
  readonly atsType = 'TEAMTAILOR' as const;
  private readonly adapter = new SharedTeamtailorAdapter();

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    try {
      const jobs = await this.adapter.fetchJobs(this.toAdapterConfig(config));
      return jobs.map((job) => this.toAtsJob(job));
    } catch (error) {
      throw toTeamtailorError(error);
    }
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    try {
      const job = await this.adapter.fetchJob(this.toAdapterConfig(config), externalId);
      return job ? this.toAtsJob(job) : null;
    } catch (error) {
      throw toTeamtailorError(error);
    }
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      return await this.adapter.ping(this.toAdapterConfig(config));
    } catch {
      return false;
    }
  }

  private toAdapterConfig(config: AtsConfig): TeamtailorAdapterConfig {
    const metadata = config.metadata as { apiKey?: string } | undefined;
    const apiKey = metadata?.apiKey;
    if (!apiKey) {
      throw new Error('Teamtailor adapter requires apiKey in metadata');
    }
    return { apiKey };
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
function toTeamtailorError(error: unknown): Error {
  if (error instanceof AtsHttpError) {
    return new Error(`Teamtailor API error: ${error.status} ${error.statusText}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

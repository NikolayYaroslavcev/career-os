import type { AtsAdapter } from '../interfaces/ats-adapter.js';
import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { SmartRecruitersAdapterConfig } from '../interfaces/ats-config.js';
import { fetchPostingsPage, fetchSinglePosting, pingPostings } from '../transport/smartrecruiters-transport.js';
import { parseJob, parseJobsResponse } from '../parsers/smartrecruiters-parser.js';

const PAGE_LIMIT = 100;
const MAX_OFFSET = 1000;

/**
 * Composes transport (HTTP) + parser (pure parsing). `fetchJobs` crawls every
 * page up to `MAX_OFFSET`, mirroring providers' original `search()` loop
 * exactly (SmartRecruiters, unlike Greenhouse, has no "whole board in one
 * call" mode — it is genuinely paginated) — this is the only known-good
 * listing behavior on record, since company-watch had no prior SmartRecruiters
 * adapter of its own to preserve a different shape from (ADR-033 "concrete
 * gap"). Used directly by company-watch's wrapper; providers' `Fetcher`
 * composes the transport/parser functions itself instead (same pattern as
 * Greenhouse/Lever), to keep its own metrics/tracing/`ProviderResult`
 * envelope and per-request cursor semantics.
 */
export class SmartRecruitersAdapter implements AtsAdapter<SmartRecruitersAdapterConfig> {
  readonly atsType = 'SMARTRECRUITERS' as const;

  async fetchJobs(config: SmartRecruitersAdapterConfig): Promise<AtsRawJob[]> {
    const jobs: AtsRawJob[] = [];
    let offset = 0;

    while (offset < MAX_OFFSET) {
      const payload = await fetchPostingsPage(config, offset, PAGE_LIMIT);
      const pageJobs = parseJobsResponse(payload);

      if (pageJobs.length === 0) break;
      jobs.push(...pageJobs);

      offset += PAGE_LIMIT;
      if (offset >= payload.totalFound) break;
    }

    return jobs;
  }

  async fetchJob(config: SmartRecruitersAdapterConfig, externalId: string): Promise<AtsRawJob | null> {
    const raw = await fetchSinglePosting(config, externalId);
    return raw ? parseJob(raw) : null;
  }

  async ping(config: SmartRecruitersAdapterConfig): Promise<boolean> {
    return pingPostings(config);
  }
}

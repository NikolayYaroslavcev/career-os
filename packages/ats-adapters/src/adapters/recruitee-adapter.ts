import type { AtsAdapter } from '../interfaces/ats-adapter.js';
import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { RecruiteeAdapterConfig } from '../interfaces/ats-config.js';
import { fetchOffersPage, pingOffers } from '../transport/recruitee-transport.js';
import { parseJobsResponse } from '../parsers/recruitee-parser.js';

const PAGE_SIZE = 50;
const MAX_PAGES = 10;

/**
 * Composes transport (HTTP) + parser (pure parsing) — see ADR-033 Phase 3.
 * Closes the ADR-033 "concrete gap" for company-watch (`AtsType` already
 * declared `RECRUITEE`, no adapter existed for it until this migration) —
 * same shape as `SmartRecruitersAdapter`.
 *
 * Recruitee has no true single-job endpoint on either side of this migration
 * (providers' original `getVacancy` re-fetches the listing and filters
 * client-side) — `fetchJob` mirrors that exactly rather than inventing an
 * unverified endpoint.
 */
export class RecruiteeAdapter implements AtsAdapter<RecruiteeAdapterConfig> {
  readonly atsType = 'RECRUITEE' as const;

  async fetchJobs(config: RecruiteeAdapterConfig): Promise<AtsRawJob[]> {
    const allJobs: AtsRawJob[] = [];
    let page = 1;

    while (page <= MAX_PAGES) {
      const payload = await fetchOffersPage(config, page, PAGE_SIZE);
      const jobs = parseJobsResponse(payload);

      if (jobs.length === 0) break;

      allJobs.push(...jobs);
      page++;

      if (page > payload.meta.total_pages) break;
    }

    return allJobs;
  }

  async fetchJob(config: RecruiteeAdapterConfig, externalId: string): Promise<AtsRawJob | null> {
    const jobs = await this.fetchJobs(config);
    return jobs.find((job) => job.externalId === externalId) ?? null;
  }

  async ping(config: RecruiteeAdapterConfig): Promise<boolean> {
    return pingOffers(config);
  }
}

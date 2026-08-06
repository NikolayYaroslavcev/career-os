import type { AtsAdapter } from '../interfaces/ats-adapter.js';
import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { WorkdayAdapterConfig } from '../interfaces/ats-config.js';
import { fetchJobsPage, pingJobs } from '../transport/workday-transport.js';
import { parseJobsResponse } from '../parsers/workday-parser.js';

const DEFAULT_PAGE_SIZE = 20;
// Safety cap on total jobs fetched in one fetchJobs() call, matching
// providers' original MAX_JOBS_SAFETY_CAP — guards against an unbounded loop
// if a misbehaving server keeps reporting more results than it returns.
const MAX_JOBS_SAFETY_CAP = 500;

/**
 * Composes transport (HTTP) + parser (pure parsing) — see ADR-033 Phase 3.
 *
 * Replaces (rather than diffs against) company-watch's prior `WorkdayAdapter`
 * for the same reason as Ashby: that implementation built its request
 * subdomain from `wd${site}` (conflating the job board's `site` path segment
 * with Workday's per-tenant pod number), had no `/job/` segment in its
 * single-job URL, mapped `postedOn` text straight through `new Date()`
 * (always producing `Invalid Date`), and had zero test coverage. None of
 * that was a genuine, working alternate shape worth preserving — see ADR-033
 * addendum "Workday migration".
 *
 * Workday has no reachable single-job endpoint from just an id — `fetchJob`
 * fetches the full (paginated) listing and filters client-side, matching
 * providers' original `getVacancy`, for both consumers now.
 */
export class WorkdayAdapter implements AtsAdapter<WorkdayAdapterConfig> {
  readonly atsType = 'WORKDAY' as const;

  async fetchJobs(config: WorkdayAdapterConfig): Promise<AtsRawJob[]> {
    const fetchedAt = new Date();
    const allJobs: AtsRawJob[] = [];
    const seenIds = new Set<string>();
    let offset = 0;
    let hasMore = true;

    while (hasMore && allJobs.length < MAX_JOBS_SAFETY_CAP) {
      const payload = await fetchJobsPage(config, offset, DEFAULT_PAGE_SIZE);
      const jobs = parseJobsResponse(config, payload, fetchedAt);

      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }

      offset += DEFAULT_PAGE_SIZE;
      hasMore = jobs.length > 0 && offset < payload.total;
    }

    return allJobs;
  }

  async fetchJob(config: WorkdayAdapterConfig, externalId: string): Promise<AtsRawJob | null> {
    const jobs = await this.fetchJobs(config);
    return jobs.find((job) => job.externalId === externalId) ?? null;
  }

  async ping(config: WorkdayAdapterConfig): Promise<boolean> {
    return pingJobs(config);
  }
}

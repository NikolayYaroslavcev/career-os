import type { AtsAdapter } from '../interfaces/ats-adapter.js';
import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { AshbyAdapterConfig } from '../interfaces/ats-config.js';
import { fetchJobBoard, pingJobBoard } from '../transport/ashby-transport.js';
import { parseJobsResponse } from '../parsers/ashby-parser.js';

/**
 * Composes transport (HTTP) + parser (pure parsing) — see ADR-033 Phase 3.
 *
 * Closes the Ashby duplication the same way SmartRecruiters/Recruitee closed
 * their registry gaps, but for a different reason: company-watch's prior
 * `AshbyAdapter` called an undocumented GraphQL endpoint that never embedded
 * `jobBoardName` in the request — it could not actually select a company's
 * board, had zero test coverage, and is not a "working alternate shape" worth
 * preserving the way Lever's paginated-vs-bare URLs were. This class replaces
 * it outright with the same documented REST Job Board API providers' fetcher
 * already used successfully. See ADR-033 addendum "Ashby migration".
 *
 * Ashby has no true single-job endpoint on either side of this migration —
 * `fetchJob` fetches the full board and filters client-side, matching
 * providers' original `getVacancy`.
 */
export class AshbyAdapter implements AtsAdapter<AshbyAdapterConfig> {
  readonly atsType = 'ASHBY' as const;

  async fetchJobs(config: AshbyAdapterConfig): Promise<AtsRawJob[]> {
    const payload = await fetchJobBoard(config);
    return parseJobsResponse(payload);
  }

  async fetchJob(config: AshbyAdapterConfig, externalId: string): Promise<AtsRawJob | null> {
    const jobs = await this.fetchJobs(config);
    return jobs.find((job) => job.externalId === externalId) ?? null;
  }

  async ping(config: AshbyAdapterConfig): Promise<boolean> {
    return pingJobBoard(config);
  }
}

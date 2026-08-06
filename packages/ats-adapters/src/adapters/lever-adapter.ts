import type { AtsAdapter } from '../interfaces/ats-adapter.js';
import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { LeverAdapterConfig } from '../interfaces/ats-config.js';
import { fetchAllPostings, fetchSinglePosting, pingAllPostings, type LeverPostingPayload } from '../transport/lever-transport.js';
import { parseJob, parseJobsResponse } from '../parsers/lever-parser.js';

/**
 * Composes the unpaged/all-postings transport shape — this is what
 * company-watch's prior `LeverAdapter` did (fetch the whole board in one
 * shot, no pagination, no validity filtering).
 *
 * providers' `LeverFetcher` does NOT use this class: it needs pagination
 * (`skip`/`limit`/`mode=json`), validity filtering, and its own
 * metrics/tracing/`ProviderResult` error envelope, so it composes the
 * transport + parser functions directly instead — see ADR-033 addendum
 * "Lever migration parity" for why a single shared class can't serve both
 * consumers identically for Lever the way it could for Greenhouse.
 */
export class LeverAdapter implements AtsAdapter<LeverAdapterConfig> {
  readonly atsType = 'LEVER' as const;

  async fetchJobs(config: LeverAdapterConfig): Promise<AtsRawJob[]> {
    const payload = await fetchAllPostings(config);
    return parseJobsResponse(payload as readonly LeverPostingPayload[]);
  }

  async fetchJob(config: LeverAdapterConfig, externalId: string): Promise<AtsRawJob | null> {
    const raw = await fetchSinglePosting(config, externalId);
    return raw ? parseJob(raw) : null;
  }

  async ping(config: LeverAdapterConfig): Promise<boolean> {
    return pingAllPostings(config);
  }
}

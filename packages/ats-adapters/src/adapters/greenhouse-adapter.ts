import type { AtsAdapter } from '../interfaces/ats-adapter.js';
import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { GreenhouseAdapterConfig } from '../interfaces/ats-config.js';
import { fetchJobsPage, fetchSingleJob, pingBoard } from '../transport/greenhouse-transport.js';
import { parseJob, parseJobsResponse } from '../parsers/greenhouse-parser.js';

/** Composes transport (HTTP) + parser (pure parsing) — see ADR-033 Phase 3. */
export class GreenhouseAdapter implements AtsAdapter<GreenhouseAdapterConfig> {
  readonly atsType = 'GREENHOUSE' as const;

  async fetchJobs(config: GreenhouseAdapterConfig): Promise<AtsRawJob[]> {
    const payload = await fetchJobsPage(config);
    return parseJobsResponse(payload);
  }

  async fetchJob(config: GreenhouseAdapterConfig, externalId: string): Promise<AtsRawJob | null> {
    const raw = await fetchSingleJob(config, externalId);
    return raw ? parseJob(raw) : null;
  }

  async ping(config: GreenhouseAdapterConfig): Promise<boolean> {
    return pingBoard(config);
  }
}

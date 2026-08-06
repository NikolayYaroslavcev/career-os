import type { AtsAdapter } from '../interfaces/ats-adapter.js';
import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { WorkableAdapterConfig } from '../interfaces/ats-config.js';
import { fetchWidget, pingWidget } from '../transport/workable-transport.js';
import { parseJobsResponse } from '../parsers/workable-parser.js';

/**
 * Composes transport (HTTP) + parser (pure parsing) — see ADR-033 Phase 3 and
 * research/free-provider-expansion/EPIC.md Phase 1. Like Greenhouse, the
 * widget endpoint returns the whole current job list in one response, so
 * `fetchJob` fetches the full list and filters client-side — Workable's
 * widget has no single-job endpoint of its own.
 */
export class WorkableAdapter implements AtsAdapter<WorkableAdapterConfig> {
  readonly atsType = 'WORKABLE' as const;

  async fetchJobs(config: WorkableAdapterConfig): Promise<AtsRawJob[]> {
    const payload = await fetchWidget(config);
    return parseJobsResponse(payload);
  }

  async fetchJob(config: WorkableAdapterConfig, externalId: string): Promise<AtsRawJob | null> {
    const jobs = await this.fetchJobs(config);
    return jobs.find((job) => job.externalId === externalId) ?? null;
  }

  async ping(config: WorkableAdapterConfig): Promise<boolean> {
    return pingWidget(config);
  }
}

import type { AtsAdapter } from '../interfaces/ats-adapter.js';
import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { PersonioAdapterConfig } from '../interfaces/ats-config.js';
import { fetchXmlFeed, pingXmlFeed } from '../transport/personio-transport.js';
import { parseFeed } from '../parsers/personio-parser.js';

/**
 * Composes transport (HTTP) + parser (pure parsing) — see ADR-033 Phase 3 and
 * research/free-provider-expansion/EPIC.md Phase 1. Personio has no
 * pagination and no reachable single-job endpoint (the XML feed returns the
 * whole board in one response and carries no per-position URL of its own),
 * so `fetchJob` fetches the full feed and filters client-side — same shape
 * as the Workday and Ashby adapters.
 */
export class PersonioAdapter implements AtsAdapter<PersonioAdapterConfig> {
  readonly atsType = 'PERSONIO' as const;

  async fetchJobs(config: PersonioAdapterConfig): Promise<AtsRawJob[]> {
    const xml = await fetchXmlFeed(config);
    return parseFeed(config, xml);
  }

  async fetchJob(config: PersonioAdapterConfig, externalId: string): Promise<AtsRawJob | null> {
    const jobs = await this.fetchJobs(config);
    return jobs.find((job) => job.externalId === externalId) ?? null;
  }

  async ping(config: PersonioAdapterConfig): Promise<boolean> {
    return pingXmlFeed(config);
  }
}

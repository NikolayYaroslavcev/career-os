import type { AtsAdapter } from '../interfaces/ats-adapter.js';
import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { TeamtailorAdapterConfig } from '../interfaces/ats-config.js';
import { fetchJobsPage, fetchSingleJob, pingJobs } from '../transport/teamtailor-transport.js';
import { parseJob, isValidTeamtailorJob } from '../parsers/teamtailor-parser.js';

const DEFAULT_PAGE_SIZE = 20;
// Safety cap on pages walked in one fetchJobs() call, matching providers'
// original MAX_PAGES_SAFETY_CAP — guards against an unbounded loop if a
// misbehaving server keeps reporting a `next` link.
const MAX_PAGES_SAFETY_CAP = 25;

/**
 * Composes transport (HTTP) + parser (pure parsing) — see ADR-033 Phase 3.
 *
 * Replaces (rather than diffs against) company-watch's prior
 * `TeamtailorAdapter` for the same reason as Ashby/Workday: it authenticated
 * with an `X-Api-Key` header Teamtailor's API doesn't document or recognize
 * (the real scheme is `Authorization: Token token=...` plus
 * `X-Api-Version`), read job fields under names that don't exist on the real
 * Teamtailor Job resource (`description`/`description-html`/`location`/
 * `remote` instead of `body`/`pitch`/`locationName`/`remote-status`), and
 * hardcoded a career-site URL pattern (`jobs.teamtailor.com/jobs/{id}`) that
 * doesn't match Teamtailor's real per-company career sites. It had zero test
 * coverage. See ADR-033 addendum "Teamtailor migration".
 *
 * Unlike Ashby/Workday, Teamtailor does have a real single-job endpoint on
 * both sides — `fetchJob` uses it directly.
 */
export class TeamtailorAdapter implements AtsAdapter<TeamtailorAdapterConfig> {
  readonly atsType = 'TEAMTAILOR' as const;

  async fetchJobs(config: TeamtailorAdapterConfig): Promise<AtsRawJob[]> {
    const allJobs: AtsRawJob[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= MAX_PAGES_SAFETY_CAP) {
      const payload = await fetchJobsPage(config, page, DEFAULT_PAGE_SIZE);
      allJobs.push(...payload.data.filter(isValidTeamtailorJob).map((item) => parseJob(item, payload.included)));

      hasNext = !!payload.links?.next;
      page += 1;
    }

    return allJobs;
  }

  async fetchJob(config: TeamtailorAdapterConfig, externalId: string): Promise<AtsRawJob | null> {
    const payload = await fetchSingleJob(config, externalId);
    if (!payload) return null;
    return parseJob(payload.data, payload.included);
  }

  async ping(config: TeamtailorAdapterConfig): Promise<boolean> {
    return pingJobs(config);
  }
}

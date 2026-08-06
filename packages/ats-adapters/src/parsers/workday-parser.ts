import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { WorkdayAdapterConfig } from '../interfaces/ats-config.js';
import { buildJobUrl, type WorkdayJobPostingPayload, type WorkdayJobsPayload } from '../transport/workday-transport.js';

/**
 * Pure parsing only — no HTTP, no I/O. Mirrors providers' original
 * `WorkdayFetcher.parseResponse`/`isValidJobPosting`/`parsePostedDate`
 * byte-for-byte — the only prior implementation ported. Company-watch's
 * `WorkdayAdapter` mapped `postedOn` (a free-text string like "Posted 3 Days
 * Ago") directly through `new Date(postedOn)`, which produces `Invalid Date`
 * for every real Workday posting — found during this migration, not a
 * "different but working" shape worth preserving (unlike Lever's genuine
 * dual URL shapes). Both consumers now get the correct relative-date parsing
 * providers' fetcher already had. See ADR-033 addendum "Workday migration".
 *
 * `location` is left `undefined` when absent rather than defaulting to `''`
 * (providers' own convention) — that default lives in the provider wrapper.
 */

/** Matches providers' original `isValidJobPosting` shape check exactly. */
export function isValidWorkdayJobPosting(item: unknown): item is WorkdayJobPostingPayload {
  return (
    typeof item === 'object' &&
    item !== null &&
    'title' in item &&
    'externalPath' in item
  );
}

/** Matches providers' original `parsePostedDate` exactly. */
function parsePostedDate(postedOn: string | undefined, fetchedAt: Date): Date {
  if (!postedOn) {
    return fetchedAt;
  }

  if (/Posted Today/i.test(postedOn)) {
    return fetchedAt;
  }

  const match = /Posted (\d+)\+? Days? Ago/i.exec(postedOn);
  if (match) {
    const days = Number(match[1]);
    return new Date(fetchedAt.getTime() - days * 24 * 60 * 60 * 1000);
  }

  return fetchedAt;
}

export function parseJob(config: WorkdayAdapterConfig, item: WorkdayJobPostingPayload, fetchedAt: Date = new Date()): AtsRawJob {
  return {
    externalId: item.jobReqId || item.externalPath,
    title: item.title,
    description: `${item.locationsText ?? ''} — full description available at the listing page (req ${item.jobReqId}).`,
    url: buildJobUrl(config, item.externalPath),
    location: item.locationsText || undefined,
    publishedAt: parsePostedDate(item.postedOn, fetchedAt),
    departments: undefined,
    rawMetadata: item,
  };
}

/** Matches providers' original `parseResponse` — throws on an invalid payload shape, filters per-item via `isValidWorkdayJobPosting`. */
export function parseJobsResponse(config: WorkdayAdapterConfig, payload: WorkdayJobsPayload, fetchedAt: Date = new Date()): AtsRawJob[] {
  if (!payload || !Array.isArray(payload.jobPostings)) {
    throw new Error('Response is not a valid Workday jobs payload');
  }
  return payload.jobPostings.filter(isValidWorkdayJobPosting).map((item) => parseJob(config, item, fetchedAt));
}

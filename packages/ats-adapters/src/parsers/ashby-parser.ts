import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { AshbyJobBoardPayload, AshbyJobPayload } from '../transport/ashby-transport.js';

/**
 * Pure parsing only — no HTTP, no I/O. Mirrors providers' original
 * `AshbyFetcher.parseResponse`/`isValidJob` byte-for-byte — the only prior
 * implementation ported (see transport module doc comment on why
 * company-watch's GraphQL-based `AshbyAdapter` was replaced, not diffed).
 *
 * `location` is left `undefined` when absent rather than defaulting to `''`
 * (providers' own convention for Ashby) — that default lives in the provider
 * wrapper, matching every other ATS's canonical parser.
 */

/** Matches providers' original `isValidJob` shape check exactly (presence check via `in`, not `typeof`). */
export function isValidAshbyJob(item: unknown): item is AshbyJobPayload {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'title' in item &&
    'descriptionHtml' in item &&
    'jobUrl' in item
  );
}

export function parseJob(item: AshbyJobPayload): AtsRawJob {
  return {
    externalId: String(item.id),
    title: item.title,
    description: item.descriptionHtml,
    url: item.jobUrl,
    location: item.locationName || undefined,
    publishedAt: new Date(item.publishedAt),
    departments: undefined,
    rawMetadata: item,
  };
}

/**
 * Matches providers' original `parseResponse` exactly: throws (rather than
 * returning an empty array) when the payload shape itself is invalid, then
 * filters through `isValidAshbyJob` before mapping each entry.
 */
export function parseJobsResponse(payload: AshbyJobBoardPayload): AtsRawJob[] {
  if (!payload || !Array.isArray(payload.jobs)) {
    throw new Error('Response is not a valid Ashby job board payload');
  }
  return payload.jobs.filter(isValidAshbyJob).map((item) => parseJob(item));
}

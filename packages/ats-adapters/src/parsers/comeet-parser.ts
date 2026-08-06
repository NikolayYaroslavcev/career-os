import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { ComeetJobPayload, ComeetListPayload } from '../transport/comeet-transport.js';

/**
 * Pure parsing only — no HTTP, no I/O. Mirrors providers' original
 * `ComeetFetcher.parseResponse`/`isValidJob`/`extractDescription`
 * byte-for-byte. No company-watch consumer exists for Comeet (`AtsType` has
 * no `COMEET` value), so there is no second implementation to diff against —
 * this closes a "gap" purely on the `providers` side.
 *
 * `location` is left `undefined` when absent rather than defaulting to
 * `'Unknown'` — that default lives in the provider wrapper, matching every
 * other ATS's canonical parser. Comeet has no salary field at all (the
 * original fetcher never set `RawJob.salary`), so the canonical shape omits
 * it entirely rather than defaulting to `undefined` explicitly.
 */

/** Matches providers' original `isValidJob` shape check exactly. */
export function isValidComeetJob(item: unknown): item is ComeetJobPayload {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>)['uid'] === 'string' &&
    typeof (item as Record<string, unknown>)['name'] === 'string'
  );
}

/** Matches providers' original `extractDescription` exactly. */
function extractDescription(details: ComeetJobPayload['details']): string {
  if (!details) return '';
  return details
    .map((section) => section.value)
    .filter((value): value is string => Boolean(value))
    .join('\n\n');
}

export function parseJob(job: ComeetJobPayload): AtsRawJob {
  return {
    externalId: job.uid,
    title: job.name,
    description: extractDescription(job.details),
    url: job.url_active_page || job.position_url,
    location: job.location?.name || undefined,
    publishedAt: new Date(job.time_updated),
    departments: undefined,
    rawMetadata: job,
  };
}

/** Filters through `isValidComeetJob` then maps — matches providers' original behavior. */
export function parseJobsResponse(payload: ComeetListPayload): AtsRawJob[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.filter(isValidComeetJob).map((job) => parseJob(job));
}

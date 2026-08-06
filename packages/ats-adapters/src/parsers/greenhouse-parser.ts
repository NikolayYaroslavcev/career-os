import type { AtsRawJob, AtsRawJobSalary } from '../interfaces/ats-raw-job.js';
import type {
  GreenhouseJobsPayload,
  GreenhouseRawJobPayload,
  GreenhousePayRangePayload,
} from '../transport/greenhouse-transport.js';

/**
 * Pure parsing only — no HTTP, no I/O. Mirrors `providers`' and
 * `company-watch`'s previously-duplicated field mapping byte-for-byte
 * (title/content/url/location/salary/departments). Technology extraction is
 * intentionally NOT here — see `AtsRawJob` doc comment.
 */

/**
 * Matches `providers`' original `GreenhouseFetcher.isValidJob` shape check.
 * `company-watch`'s prior implementation never validated — it mapped every
 * job unconditionally. That divergence predates this package and is
 * preserved: `company-watch`'s wrapper does not call this; `providers`' does.
 */
export function isValidGreenhouseJob(item: unknown): item is GreenhouseRawJobPayload {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'title' in item &&
    'content' in item &&
    'absolute_url' in item
  );
}

function parseSalary(ranges: readonly GreenhousePayRangePayload[] | null | undefined): AtsRawJobSalary | undefined {
  const range = ranges?.[0];
  if (!range || (range.min_cents == null && range.max_cents == null)) {
    return undefined;
  }

  return {
    min: range.min_cents != null ? range.min_cents / 100 : undefined,
    max: range.max_cents != null ? range.max_cents / 100 : undefined,
    currency: range.currency_type ?? 'USD',
  };
}

export function parseJob(item: GreenhouseRawJobPayload): AtsRawJob {
  return {
    externalId: String(item.id),
    title: item.title,
    description: item.content || '',
    url: item.absolute_url,
    location: item.location?.name,
    salary: parseSalary(item.pay_input_ranges),
    publishedAt: new Date(item.updated_at),
    departments: item.departments?.map((d) => d.name),
    rawMetadata: item.metadata,
  };
}

/** Parses every job in a board listing unconditionally (no validity filtering — see `isValidGreenhouseJob`). */
export function parseJobsResponse(payload: GreenhouseJobsPayload): AtsRawJob[] {
  return payload.jobs.map((job) => parseJob(job));
}

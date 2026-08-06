import type { AtsRawJob, AtsRawJobSalary } from '../interfaces/ats-raw-job.js';
import type { LeverPostingPayload, LeverSalaryRangePayload } from '../transport/lever-transport.js';

/**
 * Pure parsing only — no HTTP, no I/O. Mirrors the fields both prior
 * implementations already derived identically (`id`/`text`/`hostedUrl`/
 * `createdAt`/`categories.location`/`salaryRange`).
 *
 * Unlike Greenhouse, `technologies` and `departments` are NOT computed here
 * at all — the two prior implementations don't just format them
 * differently, they derive them from genuinely different raw data:
 * providers' `LeverFetcher` copies the `tags` array verbatim; company-watch's
 * `LeverAdapter` regex-matches keywords out of the description text. Baking
 * either into the canonical model would silently change the other
 * consumer's output. `rawMetadata` carries the untouched posting so each
 * consumer keeps deriving its own shape from it exactly as before — see
 * ADR-033 addendum "Lever migration parity".
 */

/** Matches providers' original `isValidJob` shape check exactly. */
export function isValidLeverPosting(item: unknown): item is LeverPostingPayload {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'text' in item &&
    'hostedUrl' in item &&
    'createdAt' in item
  );
}

function parseSalary(range: LeverSalaryRangePayload | undefined): AtsRawJobSalary | undefined {
  if (!range || (range.min == null && range.max == null)) {
    return undefined;
  }

  return {
    min: range.min,
    max: range.max,
    currency: range.currency ?? 'USD',
  };
}

/**
 * Description prefers `description` over `descriptionPlain`, matching
 * providers' original order. company-watch's prior code checked a
 * `descriptionHtml` field first — that field does not exist on real Lever
 * postings (only `description`/`descriptionPlain` do, per the fixtures both
 * packages already test against), so it always fell through to `description`
 * in practice. This canonical order reproduces that same observed value; see
 * ADR-033 addendum for the full trace.
 */
export function parseJob(item: LeverPostingPayload): AtsRawJob {
  return {
    externalId: item.id,
    title: item.text,
    description: item.description ?? item.descriptionPlain ?? '',
    url: item.hostedUrl,
    location: item.categories?.location,
    salary: parseSalary(item.salaryRange),
    publishedAt: new Date(item.createdAt),
    rawMetadata: item,
  };
}

/** Parses every posting unconditionally (no validity filtering) — matches company-watch's prior behavior. */
export function parseJobsResponse(payload: readonly LeverPostingPayload[]): AtsRawJob[] {
  return payload.map((item) => parseJob(item));
}

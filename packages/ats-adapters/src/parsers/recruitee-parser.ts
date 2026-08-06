import type { AtsRawJob, AtsRawJobSalary } from '../interfaces/ats-raw-job.js';
import type { RecruiteeListPayload, RecruiteeOfferPayload } from '../transport/recruitee-transport.js';

/**
 * Pure parsing only — no HTTP, no I/O. Mirrors providers' original
 * `RecruiteeFetcher.parseResponse`/`isValidOffer`/`parseSalary` byte-for-byte;
 * company-watch had no prior Recruitee implementation to diff against
 * (ADR-033 "concrete gap" — closed by this pass, same shape as
 * SmartRecruiters).
 *
 * `location` is left `undefined` when absent rather than defaulting to
 * `'Unknown'` — that default was applied inside providers' `RawJob`
 * construction, not a canonical parsing rule (same convention as
 * Greenhouse/SmartRecruiters).
 */

/** Matches providers' original `isValidOffer` shape check exactly. */
export function isValidRecruiteeOffer(item: unknown): item is RecruiteeOfferPayload {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>)['id'] === 'number' &&
    typeof (item as Record<string, unknown>)['title'] === 'string'
  );
}

/**
 * Matches providers' original `parseSalary` exactly, including its falsy
 * (not nullish) check and hardcoded `EUR` currency (Recruitee's API returns
 * salary as bare numbers with no currency field of its own).
 */
function parseSalary(offer: RecruiteeOfferPayload): AtsRawJobSalary | undefined {
  if (!offer.salary_from && !offer.salary_to) return undefined;

  return {
    min: offer.salary_from ?? undefined,
    max: offer.salary_to ?? undefined,
    currency: 'EUR',
  };
}

export function parseJob(offer: RecruiteeOfferPayload): AtsRawJob {
  return {
    externalId: String(offer.id),
    title: offer.title,
    description: offer.description,
    url: offer.apply_url,
    location: offer.location || undefined,
    salary: parseSalary(offer),
    publishedAt: new Date(offer.created_at),
    departments: undefined,
    rawMetadata: offer,
  };
}

/** Filters through `isValidRecruiteeOffer` then maps — matches providers' original behavior. */
export function parseJobsResponse(payload: RecruiteeListPayload): AtsRawJob[] {
  if (!payload.offers || !Array.isArray(payload.offers)) {
    return [];
  }
  return payload.offers.filter(isValidRecruiteeOffer).map((offer) => parseJob(offer));
}

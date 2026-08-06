import type { AtsRawJob, AtsRawJobSalary } from '../interfaces/ats-raw-job.js';
import type {
  SmartRecruitersListPayload,
  SmartRecruitersPostingPayload,
  SmartRecruitersSalaryPayload,
} from '../transport/smartrecruiters-transport.js';

/**
 * Pure parsing only — no HTTP, no I/O. Mirrors providers' original
 * `SmartRecruitersFetcher.parseResponse`/`isValidPosting`/`parseSalary`
 * byte-for-byte; company-watch had no prior SmartRecruiters implementation
 * to diff against (ADR-033 "concrete gap" — closed by this pass).
 *
 * `location` and `departments` are left `undefined` when absent rather than
 * defaulting to `'Unknown'` — that default was applied inside providers'
 * `RawJob` construction, not a canonical parsing rule, so it stays in the
 * provider wrapper (mirrors how Greenhouse's `''` location fallback lives in
 * `GreenhouseFetcher.toRawJob`, not the shared parser).
 */

/** Matches providers' original `isValidPosting` shape check exactly. */
export function isValidSmartRecruitersPosting(item: unknown): item is SmartRecruitersPostingPayload {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>)['id'] === 'string' &&
    typeof (item as Record<string, unknown>)['name'] === 'string'
  );
}

/**
 * Matches providers' original `parseSalary` exactly, including its falsy
 * (not nullish) check: `!salary.min && !salary.max` treats a `0` salary
 * bound as absent, unlike Greenhouse's `== null` check. Preserved as-is.
 */
function parseSalary(salary: SmartRecruitersSalaryPayload | null): AtsRawJobSalary | undefined {
  if (!salary) return undefined;
  if (!salary.min && !salary.max) return undefined;

  return {
    min: salary.min ?? undefined,
    max: salary.max ?? undefined,
    currency: salary.currency ?? 'USD',
  };
}

export function parseJob(item: SmartRecruitersPostingPayload): AtsRawJob {
  const location = [item.city, item.country].filter(Boolean).join(', ') || undefined;

  return {
    externalId: item.id,
    title: item.name,
    description: item.description,
    url: item.applyUrl,
    location,
    salary: parseSalary(item.salary),
    publishedAt: new Date(item.releasedDate),
    departments: item.department?.name ? [item.department.name] : undefined,
    rawMetadata: item,
  };
}

/** Filters through `isValidSmartRecruitersPosting` then maps — the only known-good behavior (providers' original always validated). */
export function parseJobsResponse(payload: SmartRecruitersListPayload): AtsRawJob[] {
  if (!payload.content || !Array.isArray(payload.content)) {
    return [];
  }
  return payload.content.filter(isValidSmartRecruitersPosting).map((item) => parseJob(item));
}

import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { WorkableJobPayload, WorkableWidgetPayload } from '../transport/workable-transport.js';

/** Matches the widget response shape verified live against a real account. */
export function isValidWorkableJob(item: unknown): item is WorkableJobPayload {
  return (
    typeof item === 'object' &&
    item !== null &&
    'shortcode' in item &&
    'title' in item &&
    'application_url' in item
  );
}

function joinLocation(job: WorkableJobPayload): string | undefined {
  if (job.locations && job.locations.length > 0) {
    const parts = job.locations
      .map((l) => [l.city, l.region, l.country].filter(Boolean).join(', '))
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' | ');
  }

  const parts = [job.city, job.state, job.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Uses `application_url` (not `url`/`shortlink`) as the canonical URL —
 * `application_url` is the direct-apply link (`.../apply`), matching
 * CareerOS's direct-apply requirement (ADR-034 precedent), where `url` only
 * points at the job listing/description page.
 */
export function parseJob(job: WorkableJobPayload): AtsRawJob {
  return {
    externalId: job.shortcode,
    title: job.title,
    description: job.description ?? '',
    url: job.application_url,
    location: joinLocation(job),
    publishedAt: job.created_at ? new Date(job.created_at) : job.published_on ? new Date(job.published_on) : undefined,
    departments: job.department ? [job.department] : undefined,
    rawMetadata: job,
  };
}

/** Parses every job in the widget payload, skipping malformed entries rather than throwing. */
export function parseJobsResponse(payload: WorkableWidgetPayload): AtsRawJob[] {
  if (!payload || !Array.isArray(payload.jobs)) {
    return [];
  }
  return payload.jobs.filter(isValidWorkableJob).map(parseJob);
}

import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { WorkdayAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_HOST = 'wd1.myworkdayjobs.com';

export interface WorkdayJobPostingPayload {
  readonly title: string;
  readonly externalPath: string;
  readonly locationsText: string;
  readonly postedOn?: string;
  readonly bulletFields?: readonly string[];
  readonly jobReqId: string;
}

export interface WorkdayJobsPayload {
  readonly total: number;
  readonly jobPostings: readonly WorkdayJobPostingPayload[];
}

function host(config: WorkdayAdapterConfig): string {
  return config.host ?? DEFAULT_HOST;
}

/**
 * Matches providers' original `buildApiUrl` exactly. Workday has no single
 * universal API host — every tenant is served from its own `{tenant}.{host}`
 * subdomain, where `host` is a per-tenant "pod" (`wd1`, `wd2`, `wd3`, ...),
 * not to be confused with `site` (the job board's own path segment, e.g.
 * `External`). The prior `company-watch` `WorkdayAdapter` conflated the two
 * (`wd${site}` as the subdomain) — see ADR-033 addendum "Workday migration"
 * for why that was replaced rather than preserved as a second working shape.
 */
function apiUrl(config: WorkdayAdapterConfig): string {
  return `https://${config.tenant}.${host(config)}/wday/cxs/${config.tenant}/${config.site}/jobs`;
}

/** Matches providers' original `buildPublicUrl` — `externalPath` already starts with `/job/...`. */
export function buildJobUrl(config: WorkdayAdapterConfig, externalPath: string): string {
  return `https://${config.tenant}.${host(config)}${externalPath}`;
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw new AtsHttpError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      response.statusText,
    );
  }
}

/** Fetches a single page of the CXS jobs listing. Matches providers' original `buildRequestBody`. */
export async function fetchJobsPage(
  config: WorkdayAdapterConfig,
  offset: number,
  limit: number,
  searchText: string = '',
): Promise<WorkdayJobsPayload> {
  const response = await fetchWithTimeout(apiUrl(config), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText }),
  });
  await assertOk(response);
  return (await response.json()) as WorkdayJobsPayload;
}

/**
 * Liveness check. The CXS jobs endpoint only accepts POST — there is no
 * lighter HEAD route available, so a minimal single-result request is sent,
 * matching providers' original `ping`.
 */
export async function pingJobs(config: WorkdayAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(apiUrl(config), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }),
  });
  return response.ok;
}

import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { AshbyAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_BASE_URL = 'https://api.ashbyhq.com/posting-api/job-board';

export type AshbyEmploymentTypePayload = 'FullTime' | 'PartTime' | 'Intern' | 'Contract' | 'Temporary';

export interface AshbyJobPayload {
  readonly id: string;
  readonly title: string;
  readonly departmentName?: string | null;
  readonly teamName?: string | null;
  readonly locationName: string;
  readonly isRemote: boolean;
  readonly descriptionHtml: string;
  readonly publishedAt: string;
  readonly employmentType?: AshbyEmploymentTypePayload;
  readonly jobUrl: string;
  readonly applyUrl?: string;
}

export interface AshbyJobBoardPayload {
  readonly jobs: readonly AshbyJobPayload[];
  readonly apiVersion?: string;
}

function baseUrl(config: AshbyAdapterConfig): string {
  return config.baseUrl ?? DEFAULT_BASE_URL;
}

/**
 * Matches providers' original `buildJobsUrl` exactly — the documented public
 * Job Board REST API (https://developers.ashbyhq.com/reference/job-board-api),
 * keyed by `jobBoardName`. This is the only implementation ported: the prior
 * `company-watch` `AshbyAdapter` called a different, undocumented GraphQL
 * endpoint (`jobs.ashbyhq.com/api/non-user-graphql`) that never actually
 * embedded `jobBoardName` in the request — see ADR-033 addendum "Ashby
 * migration" for the full trace of why that implementation was replaced
 * rather than preserved.
 */
function jobBoardUrl(config: AshbyAdapterConfig): string {
  return `${baseUrl(config)}/${config.jobBoardName}?includeCompensation=true`;
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

/** Fetches the full job board listing in one request — Ashby has no pagination. */
export async function fetchJobBoard(config: AshbyAdapterConfig): Promise<AshbyJobBoardPayload> {
  const response = await fetchWithTimeout(jobBoardUrl(config), {
    headers: { Accept: 'application/json' },
  });
  await assertOk(response);
  return (await response.json()) as AshbyJobBoardPayload;
}

/** Liveness check via HEAD, matching providers' original `ping`. */
export async function pingJobBoard(config: AshbyAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(jobBoardUrl(config), { method: 'HEAD' });
  return response.ok;
}

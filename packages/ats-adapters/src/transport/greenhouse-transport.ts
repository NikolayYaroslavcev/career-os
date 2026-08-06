import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { GreenhouseAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';

export interface GreenhouseMetadataFieldPayload {
  readonly id: number;
  readonly name: string;
  readonly value: string | null;
}

export interface GreenhousePayRangePayload {
  readonly min_cents: number | null;
  readonly max_cents: number | null;
  readonly currency_type: string | null;
}

export interface GreenhouseRawJobPayload {
  readonly id: number;
  readonly title: string;
  readonly updated_at: string;
  readonly absolute_url: string;
  readonly content: string;
  readonly location: { readonly name: string };
  readonly departments?: readonly { readonly id: number; readonly name: string }[];
  readonly metadata?: readonly GreenhouseMetadataFieldPayload[] | null;
  readonly pay_input_ranges?: readonly GreenhousePayRangePayload[] | null;
}

export interface GreenhouseJobsPayload {
  readonly jobs: readonly GreenhouseRawJobPayload[];
}

function boardUrl(config: GreenhouseAdapterConfig): string {
  return `${config.baseUrl ?? DEFAULT_BASE_URL}/${config.boardToken}`;
}

function jobsUrl(config: GreenhouseAdapterConfig): string {
  return `${boardUrl(config)}/jobs?content=true`;
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

/** Fetches the full board listing. Identical URL/behavior to both prior implementations. */
export async function fetchJobsPage(config: GreenhouseAdapterConfig): Promise<GreenhouseJobsPayload> {
  const response = await fetchWithTimeout(jobsUrl(config), { headers: { Accept: 'application/json' } });
  await assertOk(response);
  return (await response.json()) as GreenhouseJobsPayload;
}

/** Fetches a single job. Returns `null` on 404 (both prior implementations treat 404 as "not found", not an error). */
export async function fetchSingleJob(
  config: GreenhouseAdapterConfig,
  externalId: string,
): Promise<GreenhouseRawJobPayload | null> {
  const url = `${boardUrl(config)}/jobs/${externalId}?questions=false`;
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });

  if (response.status === 404) {
    return null;
  }
  await assertOk(response);
  return (await response.json()) as GreenhouseRawJobPayload;
}

/** HEAD request against the board listing, used as a liveness check. */
export async function pingBoard(config: GreenhouseAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(jobsUrl(config), { method: 'HEAD' });
  return response.ok;
}

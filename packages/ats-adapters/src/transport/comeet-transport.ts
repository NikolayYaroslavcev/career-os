import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { ComeetAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_BASE_URL = 'https://www.comeet.co/careers-api/2.0';

export interface ComeetLocationPayload {
  readonly name: string;
  readonly country: string | null;
  readonly city: string | null;
  readonly is_remote: boolean;
}

export interface ComeetDetailSectionPayload {
  readonly name: string;
  readonly value: string | null;
}

export interface ComeetJobPayload {
  readonly uid: string;
  readonly name: string;
  readonly department: string | null;
  readonly location: ComeetLocationPayload;
  readonly employment_type: string | null;
  readonly workplace_type: string | null;
  readonly time_updated: string;
  readonly company_name: string;
  readonly url_active_page: string;
  readonly position_url: string;
  readonly details?: readonly ComeetDetailSectionPayload[];
}

export type ComeetListPayload = readonly ComeetJobPayload[];

function baseUrl(config: ComeetAdapterConfig): string {
  return config.baseUrl ?? DEFAULT_BASE_URL;
}

/**
 * Matches providers' original `buildSearchUrl` exactly. `details=true` is
 * required to get the job description (Comeet omits it by default to keep
 * the list-all-positions response small); Comeet's API has no server-side
 * keyword filter, so `criteria.query` was never sent as a param.
 */
function positionsUrl(config: ComeetAdapterConfig, details: boolean): string {
  const url = new URL(`${baseUrl(config)}/company/${config.companyUid}/positions`);
  url.searchParams.set('token', config.token);
  if (details) {
    url.searchParams.set('details', 'true');
  }
  return url.toString();
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

/** Fetches every open position in one request — Comeet has no pagination. */
export async function fetchPositions(config: ComeetAdapterConfig): Promise<ComeetListPayload> {
  const response = await fetchWithTimeout(positionsUrl(config, true));
  await assertOk(response);
  return (await response.json()) as ComeetListPayload;
}

/**
 * Liveness check. Matches providers' original `ping` exactly: a plain GET
 * against the positions endpoint without `details=true`, not a HEAD request.
 */
export async function pingPositions(config: ComeetAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(positionsUrl(config, false));
  return response.ok;
}

import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { RecruiteeAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_BASE_URL = 'https://api.recruitee.com/v3';
const DEFAULT_PAGE_SIZE = 50;

export interface RecruiteeOfferPayload {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly location: string;
  readonly remote: boolean;
  readonly salary_from: number | null;
  readonly salary_to: number | null;
  readonly employment_type: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly apply_url: string;
  readonly department: string | null;
  readonly team: string | null;
}

export interface RecruiteeListPayload {
  readonly offers: readonly RecruiteeOfferPayload[];
  readonly meta: {
    readonly total: number;
    readonly per_page: number;
    readonly current_page: number;
    readonly total_pages: number;
  };
}

function baseUrl(config: RecruiteeAdapterConfig): string {
  return config.baseUrl ?? DEFAULT_BASE_URL;
}

/** Matches providers' original `buildSearchUrl` exactly (`page`/`per_page`/optional `q`/`remote`). */
function offersUrl(
  config: RecruiteeAdapterConfig,
  page: number,
  perPage: number,
  query?: string,
  remoteOnly?: boolean,
): string {
  const url = new URL(`${baseUrl(config)}/companies/${config.company}/offers`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));
  if (query) {
    url.searchParams.set('q', query);
  }
  if (remoteOnly) {
    url.searchParams.set('remote', 'true');
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

/** Fetches a single page of the offers listing. */
export async function fetchOffersPage(
  config: RecruiteeAdapterConfig,
  page: number = 1,
  perPage: number = DEFAULT_PAGE_SIZE,
  query?: string,
  remoteOnly?: boolean,
): Promise<RecruiteeListPayload> {
  const response = await fetchWithTimeout(offersUrl(config, page, perPage, query, remoteOnly));
  await assertOk(response);
  return (await response.json()) as RecruiteeListPayload;
}

/**
 * Liveness check. Matches providers' original `ping` exactly: a plain GET
 * against `page=1&per_page=1`, not a HEAD request (unlike Greenhouse/Lever).
 */
export async function pingOffers(config: RecruiteeAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(offersUrl(config, 1, 1));
  return response.ok;
}

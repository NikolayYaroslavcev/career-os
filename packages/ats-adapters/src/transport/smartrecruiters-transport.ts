import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { SmartRecruitersAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_BASE_URL = 'https://api.smartrecruiters.com/v1';
const DEFAULT_PAGE_LIMIT = 100;

export interface SmartRecruitersRefPayload {
  readonly id: string;
  readonly name: string;
}

export interface SmartRecruitersLocationPayload {
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface SmartRecruitersSalaryPayload {
  readonly min: number | null;
  readonly max: number | null;
  readonly currency: string;
  readonly unit: string;
}

export interface SmartRecruitersPostingPayload {
  readonly id: string;
  readonly name: string;
  readonly ref: string;
  readonly department: SmartRecruitersRefPayload | null;
  readonly occupationArea: SmartRecruitersRefPayload | null;
  readonly industry: SmartRecruitersRefPayload | null;
  readonly city: string;
  readonly country: string;
  readonly location: SmartRecruitersLocationPayload | null;
  readonly experienceLevel: SmartRecruitersRefPayload | null;
  readonly employmentType: SmartRecruitersRefPayload | null;
  readonly salary: SmartRecruitersSalaryPayload | null;
  readonly description: string;
  readonly releasedDate: string;
  readonly applyUrl: string;
  readonly language: string;
}

export interface SmartRecruitersListPayload {
  readonly offset: number;
  readonly limit: number;
  readonly totalFound: number;
  readonly content: readonly SmartRecruitersPostingPayload[];
}

function baseUrl(config: SmartRecruitersAdapterConfig): string {
  return config.baseUrl ?? DEFAULT_BASE_URL;
}

function postingsUrl(
  config: SmartRecruitersAdapterConfig,
  offset: number,
  limit: number,
  query?: string,
): string {
  const url = new URL(`${baseUrl(config)}/companies/${config.company}/postings`);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  if (query) {
    url.searchParams.set('q', query);
  }
  return url.toString();
}

function singlePostingUrl(config: SmartRecruitersAdapterConfig, externalId: string): string {
  return `${baseUrl(config)}/companies/${config.company}/postings/${externalId}`;
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

/**
 * Fetches a single page of the postings listing. Matches providers' original
 * `buildSearchUrl` exactly (`offset`/`limit`/optional `q`).
 */
export async function fetchPostingsPage(
  config: SmartRecruitersAdapterConfig,
  offset: number = 0,
  limit: number = DEFAULT_PAGE_LIMIT,
  query?: string,
): Promise<SmartRecruitersListPayload> {
  const response = await fetchWithTimeout(postingsUrl(config, offset, limit, query));
  await assertOk(response);
  return (await response.json()) as SmartRecruitersListPayload;
}

/**
 * Fetches a single posting. Returns `null` on 404, matching the shape both
 * other ATS transports use — but see the adapter/fetcher layer: providers'
 * original `getVacancy` additionally swallows every other non-ok status into
 * "not found" too (a documented quirk, preserved at the provider wrapper,
 * not here).
 */
export async function fetchSinglePosting(
  config: SmartRecruitersAdapterConfig,
  externalId: string,
): Promise<SmartRecruitersPostingPayload | null> {
  const response = await fetchWithTimeout(singlePostingUrl(config, externalId));

  if (response.status === 404) {
    return null;
  }
  await assertOk(response);
  return (await response.json()) as SmartRecruitersPostingPayload;
}

/**
 * Liveness check. Unlike Greenhouse/Lever (HEAD request), providers' original
 * `ping` issued a plain GET against `postings?limit=1` — preserved exactly,
 * not unified to HEAD.
 */
export async function pingPostings(config: SmartRecruitersAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(postingsUrl(config, 0, 1));
  return response.ok;
}

import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { LeverAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_BASE_URL = 'https://api.lever.co/v0/postings';
const DEFAULT_PAGE_LIMIT = 100;

export interface LeverCategoriesPayload {
  readonly commitment?: string;
  readonly department?: string;
  readonly location?: string;
  readonly team?: string;
  readonly allLocations?: readonly string[];
}

export interface LeverSalaryRangePayload {
  readonly min?: number;
  readonly max?: number;
  readonly currency?: string;
  readonly interval?: string;
}

export interface LeverListPayload {
  readonly text: string;
  readonly content: string;
}

export interface LeverPostingPayload {
  readonly id: string;
  readonly text: string;
  readonly categories?: LeverCategoriesPayload;
  readonly description?: string;
  readonly descriptionPlain?: string;
  readonly lists?: readonly LeverListPayload[];
  readonly hostedUrl: string;
  readonly applyUrl?: string;
  readonly createdAt: number;
  readonly workplaceType?: 'remote' | 'hybrid' | 'on-site';
  readonly salaryRange?: LeverSalaryRangePayload;
  readonly tags?: readonly string[];
}

function baseUrl(config: LeverAdapterConfig): string {
  return config.baseUrl ?? DEFAULT_BASE_URL;
}

/**
 * Matches providers' original `buildPostingsUrl` exactly: always carries
 * `mode=json` plus explicit `skip`/`limit`, even for the "first page" case.
 */
function paginatedPostingsUrl(config: LeverAdapterConfig, offset: number, limit: number): string {
  return `${baseUrl(config)}/${config.company}?mode=json&skip=${offset}&limit=${limit}`;
}

/**
 * Matches company-watch's original `buildUrl` exactly: the bare listing URL,
 * no pagination params, no `mode=json`. This is a genuine (not cosmetic)
 * difference from the provider's URL — see ADR-033 addendum "Lever migration
 * parity": company-watch fetches the entire unpaged board in one request,
 * providers' Fetcher only ever reads one page (default 100) via `search()`.
 */
function allPostingsUrl(config: LeverAdapterConfig): string {
  return `${baseUrl(config)}/${config.company}`;
}

function singlePostingUrl(config: LeverAdapterConfig, externalId: string): string {
  return `${allPostingsUrl(config)}/${externalId}`;
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

/** Paginated listing fetch — providers' Fetcher shape (always `mode=json&skip&limit`). */
export async function fetchPostingsPage(
  config: LeverAdapterConfig,
  offset: number,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<unknown> {
  const response = await fetchWithTimeout(paginatedPostingsUrl(config, offset, limit), {
    headers: { Accept: 'application/json' },
  });
  await assertOk(response);
  return response.json();
}

/** Unpaged full-listing fetch — company-watch's shape (no query params at all). */
export async function fetchAllPostings(config: LeverAdapterConfig): Promise<unknown> {
  const response = await fetchWithTimeout(allPostingsUrl(config), {
    headers: { Accept: 'application/json' },
  });
  await assertOk(response);
  return response.json();
}

/**
 * Single-posting fetch. Only company-watch's adapter calls this today.
 * providers' `LeverFetcher.getVacancy` has no true single-job lookup for
 * Lever — it re-fetches page 0 via `search({})` and finds the job
 * client-side (see ADR-033 risk "Lever postings vs. opaque-postings").
 * Preserved as-is, not "fixed", per the migration's no-behavior-change rule.
 */
export async function fetchSinglePosting(
  config: LeverAdapterConfig,
  externalId: string,
): Promise<LeverPostingPayload | null> {
  const response = await fetchWithTimeout(singlePostingUrl(config, externalId), {
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) {
    return null;
  }
  await assertOk(response);
  return (await response.json()) as LeverPostingPayload;
}

/** HEAD request against the paginated listing URL — mirrors providers' `ping`. */
export async function pingPostingsPage(
  config: LeverAdapterConfig,
  offset: number,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<boolean> {
  const response = await fetchWithTimeout(paginatedPostingsUrl(config, offset, limit), { method: 'HEAD' });
  return response.ok;
}

/** HEAD request against the bare listing URL — mirrors company-watch's `ping`. */
export async function pingAllPostings(config: LeverAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(allPostingsUrl(config), { method: 'HEAD' });
  return response.ok;
}

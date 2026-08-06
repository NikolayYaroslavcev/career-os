import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { TeamtailorAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_BASE_URL = 'https://api.teamtailor.com/v1/jobs';
const API_VERSION = '20240404';
const DEFAULT_PAGE_SIZE = 20;

export interface TeamtailorJobAttributesPayload {
  readonly title: string;
  readonly body?: string;
  readonly pitch?: string;
  readonly 'created-at': string;
  // Real Teamtailor jobs resolve location via a `locations` JSON:API
  // relationship (requires `include=locations` + resolving `included`).
  // Simplified here by trusting a denormalized `locationName` attribute
  // directly on the job resource — matches providers' original approach;
  // full location-relationship resolution is out of scope for this pass.
  readonly locationName?: string;
  readonly 'remote-status'?: string;
  readonly 'employment-type'?: string;
  readonly 'employment-level'?: string;
  readonly status?: string;
}

export interface TeamtailorRelationshipRefPayload {
  readonly data?: { readonly id: string } | null;
}

export interface TeamtailorJobRelationshipsPayload {
  readonly department?: TeamtailorRelationshipRefPayload;
  readonly role?: TeamtailorRelationshipRefPayload;
}

export interface TeamtailorJobLinksPayload {
  readonly 'careersite-job-url'?: string;
}

export interface TeamtailorJobResourcePayload {
  readonly id: string;
  readonly type: string;
  readonly attributes: TeamtailorJobAttributesPayload;
  readonly relationships?: TeamtailorJobRelationshipsPayload;
  readonly links?: TeamtailorJobLinksPayload;
}

export interface TeamtailorIncludedResourcePayload {
  readonly id: string;
  readonly type: string;
  readonly attributes: { readonly name: string };
}

export interface TeamtailorJobsListPayload {
  readonly data: readonly TeamtailorJobResourcePayload[];
  readonly included?: readonly TeamtailorIncludedResourcePayload[];
  readonly meta?: { readonly 'record-count'?: number };
  readonly links?: { readonly next?: string };
}

export interface TeamtailorJobPayload {
  readonly data: TeamtailorJobResourcePayload;
  readonly included?: readonly TeamtailorIncludedResourcePayload[];
}

function baseUrl(config: TeamtailorAdapterConfig): string {
  return config.baseUrl ?? DEFAULT_BASE_URL;
}

/**
 * Real Teamtailor auth scheme: `Authorization: Token token=...` plus a
 * required `X-Api-Version` header (https://docs.teamtailor.com/). The prior
 * company-watch `TeamtailorAdapter` sent `X-Api-Key` instead — not a header
 * Teamtailor's API documents or recognizes — see ADR-033 addendum
 * "Teamtailor migration" for why that implementation was replaced rather
 * than preserved.
 */
function headers(config: TeamtailorAdapterConfig): Record<string, string> {
  return {
    Authorization: `Token token=${config.apiKey}`,
    'X-Api-Version': API_VERSION,
    Accept: 'application/vnd.api+json',
  };
}

/** Matches providers' original `buildJobsUrl`, plus `include=department,role` so both consumers can resolve relationship names from `included`. */
function jobsUrl(config: TeamtailorAdapterConfig, page: number, perPage: number): string {
  return `${baseUrl(config)}?page%5Bnumber%5D=${page}&page%5Bsize%5D=${perPage}&filter%5Bstatus%5D=published&include=department,role`;
}

function singleJobUrl(config: TeamtailorAdapterConfig, externalId: string): string {
  return `${baseUrl(config)}/${externalId}?include=department,role`;
}

function pingUrl(config: TeamtailorAdapterConfig): string {
  return `${baseUrl(config)}?page%5Bsize%5D=1`;
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

/** Fetches a single page of the jobs listing. */
export async function fetchJobsPage(
  config: TeamtailorAdapterConfig,
  page: number = 1,
  perPage: number = DEFAULT_PAGE_SIZE,
): Promise<TeamtailorJobsListPayload> {
  const response = await fetchWithTimeout(jobsUrl(config, page, perPage), { headers: headers(config) });
  await assertOk(response);
  return (await response.json()) as TeamtailorJobsListPayload;
}

/** Fetches a single job. Returns `null` on 404, matching every other ATS transport. */
export async function fetchSingleJob(
  config: TeamtailorAdapterConfig,
  externalId: string,
): Promise<TeamtailorJobPayload | null> {
  const response = await fetchWithTimeout(singleJobUrl(config, externalId), { headers: headers(config) });

  if (response.status === 404) {
    return null;
  }
  await assertOk(response);
  return (await response.json()) as TeamtailorJobPayload;
}

/**
 * Liveness check via a minimal authenticated GET. Matches providers'
 * original `ping` — Teamtailor's API does not reliably support HEAD (the
 * prior company-watch adapter used HEAD and was never validated against a
 * real board).
 */
export async function pingJobs(config: TeamtailorAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(pingUrl(config), { headers: headers(config) });
  return response.ok;
}

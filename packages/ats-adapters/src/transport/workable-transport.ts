import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { WorkableAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_BASE_URL = 'https://apply.workable.com/api/v1/widget/accounts';

export interface WorkableLocationPayload {
  readonly country?: string;
  readonly countryCode?: string;
  readonly city?: string;
  readonly region?: string;
  readonly hidden?: boolean;
}

export interface WorkableJobPayload {
  readonly title: string;
  readonly shortcode: string;
  readonly employment_type?: string;
  readonly telecommuting?: boolean;
  readonly department?: string;
  readonly url: string;
  readonly application_url: string;
  readonly published_on?: string;
  readonly created_at?: string;
  readonly country?: string;
  readonly city?: string;
  readonly state?: string;
  readonly education?: string;
  readonly experience?: string;
  readonly function?: string;
  readonly industry?: string;
  readonly locations?: readonly WorkableLocationPayload[];
  readonly description?: string;
}

export interface WorkableWidgetPayload {
  readonly name: string;
  readonly description?: string;
  readonly jobs: readonly WorkableJobPayload[];
}

function baseUrl(config: WorkableAdapterConfig): string {
  return config.baseUrl ?? DEFAULT_BASE_URL;
}

/**
 * `https://apply.workable.com/api/v1/widget/accounts/{accountSlug}?details=true`
 * — live-verified (tested against `huggingface`, returned real jobs with
 * apply URLs). `details=true` is required to get the full `description` and
 * location fields, not just a summary list.
 */
function widgetUrl(config: WorkableAdapterConfig): string {
  return `${baseUrl(config)}/${config.accountSlug}?details=true`;
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

/** Fetches the full widget payload — no pagination, matches providers' original Greenhouse-style shape. */
export async function fetchWidget(config: WorkableAdapterConfig): Promise<WorkableWidgetPayload> {
  const response = await fetchWithTimeout(widgetUrl(config), {
    headers: { Accept: 'application/json' },
  });
  await assertOk(response);
  return (await response.json()) as WorkableWidgetPayload;
}

/**
 * Liveness check. Live-verified that `apply.workable.com`'s widget endpoint
 * returns 404 for HEAD requests (only GET is routed) — unlike Greenhouse's
 * board API, so this issues a real GET rather than the HEAD every other
 * adapter's `ping` uses.
 */
export async function pingWidget(config: WorkableAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(widgetUrl(config), {
    headers: { Accept: 'application/json' },
  });
  return response.ok;
}

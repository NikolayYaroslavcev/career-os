import { fetchWithTimeout } from '../resilience/fetch-with-timeout.js';
import { AtsHttpError } from '../errors.js';
import type { PersonioAdapterConfig } from '../interfaces/ats-config.js';

const DEFAULT_HOST = 'jobs.personio.de';
const DEFAULT_LANGUAGE = 'en';

function host(config: PersonioAdapterConfig): string {
  return config.host ?? DEFAULT_HOST;
}

/**
 * `https://{company}.jobs.personio.de/xml?language={lang}` — officially
 * documented, unauthenticated, per-tenant XML feed (Personio's own "Integrate
 * jobs via XML" support article, verified against `github.com/personio/api-docs`).
 * No pagination: the whole board comes back in one response, same shape as
 * Greenhouse's board-listing endpoint.
 */
function feedUrl(config: PersonioAdapterConfig): string {
  const language = config.language ?? DEFAULT_LANGUAGE;
  return `https://${config.company}.${host(config)}/xml?language=${encodeURIComponent(language)}`;
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

/** Fetches the full XML feed as raw text — parsing is the parser module's job, not transport's. */
export async function fetchXmlFeed(config: PersonioAdapterConfig): Promise<string> {
  const response = await fetchWithTimeout(feedUrl(config), {
    headers: { Accept: 'application/xml, text/xml' },
  });
  await assertOk(response);
  return response.text();
}

/** Liveness check against the same feed URL — Personio has no lighter/HEAD-friendly endpoint. */
export async function pingXmlFeed(config: PersonioAdapterConfig): Promise<boolean> {
  const response = await fetchWithTimeout(feedUrl(config), { method: 'HEAD' });
  return response.ok;
}

/**
 * `https://{company}.jobs.personio.de/job/{id}?language={lang}` — the feed
 * carries no per-position URL field at all (live-verified against real
 * tenant feeds), but this detail-page pattern is live-verified separately
 * (200 OK) and is the same subdomain the feed itself is served from, so it's
 * a genuine direct-apply link on the employer's own Personio-hosted career
 * site, not a third-party redirect.
 */
export function buildJobUrl(config: PersonioAdapterConfig, externalId: string): string {
  const language = config.language ?? DEFAULT_LANGUAGE;
  return `https://${config.company}.${host(config)}/job/${externalId}?language=${encodeURIComponent(language)}`;
}

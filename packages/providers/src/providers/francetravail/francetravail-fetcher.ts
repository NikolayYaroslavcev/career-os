import type { Fetcher, FetchResult } from '../../interfaces/fetcher.js';
import type { ProviderResult } from '../../interfaces/result.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import type { SearchCriteria } from '../../interfaces/search-criteria.js';
import type { SyncCursor } from '../../interfaces/sync-cursor.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { PROVIDER_METRICS } from '../../observability/metrics.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import { resilientFetch } from '../../resilience/resilient-fetch.js';
import type { FranceTravailOffer, FranceTravailSearchResponse, FranceTravailTokenResponse } from './francetravail-types.js';

const TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire';
const TOKEN_SCOPE = 'api_offresdemploiv2 o2dsoffre';
const PAGE_SIZE = 50;
const MAX_PAGES = 500;

// Software-engineering-relevant ROME occupation codes. M1805 ("Études et
// développement informatique") is the core software-dev code; without a
// codeROME filter, France Travail's search returns every profession in the
// French labor market, not just tech roles.
export const FRANCE_TRAVAIL_DEFAULT_ROME_CODES: readonly string[] = ['M1805'];

export interface FranceTravailFetcherConfig {
  readonly baseUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly romeCodes?: readonly string[];
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export class FranceTravailFetcher implements Fetcher {
  private readonly romeCodes: readonly string[];
  private cachedToken?: { readonly token: string; readonly expiresAt: number };

  constructor(private readonly config: FranceTravailFetcherConfig) {
    this.romeCodes = config.romeCodes ?? FRANCE_TRAVAIL_DEFAULT_ROME_CODES;
  }

  async search(_criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.config.tracer.startSpan('francetravail.fetcher.search', { providerId: 'france_travail' });
    const startTime = Date.now();

    try {
      this.config.logger.info('Fetching France Travail offers', { providerId: 'france_travail', operation: 'search' });

      const token = await this.getAccessToken();
      const jobs: RawJob[] = [];
      let start = 0;
      let page = 0;

      while (page < MAX_PAGES) {
        const url = new URL(this.config.baseUrl);
        url.searchParams.set('codeROME', this.romeCodes.join(','));
        url.searchParams.set('range', `${start}-${start + PAGE_SIZE - 1}`);

        const response = await resilientFetch(url.toString(), 'france_travail', {}, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // France Travail returns 204 No Content once the requested range is
        // past the end of the result set, rather than an empty 200 body.
        if (response.status === 204) break;
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const data = (await response.json()) as FranceTravailSearchResponse;
        const offers = data.resultats ?? [];
        if (offers.length === 0) break;

        jobs.push(...this.mapOffers(offers));
        if (offers.length < PAGE_SIZE) break;

        start += PAGE_SIZE;
        page += 1;
      }

      const durationMs = Date.now() - startTime;
      this.config.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'france_travail', status: 'success' });
      this.config.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'france_travail' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      return { ok: true, data: jobs, meta: { durationMs, providerMeta: { totalJobs: jobs.length } } };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.config.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'france_travail' });
      span.setAttribute('error', true);
      span.end();
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: message.startsWith('HTTP') ? ProviderErrorType.NETWORK_ERROR : ProviderErrorType.UNKNOWN_ERROR, message, retryable: true, meta: { durationMs } };
    }
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const result = await this.search({});
    if (!result.ok) return result;
    return { ok: true, data: result.data.find((j) => j.sourceId === sourceId) ?? null, meta: result.meta };
  }

  async fetchWithCursor(criteria: SearchCriteria, _cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    const result = await this.search(criteria);
    if (!result.ok) return result;
    return { ok: true, data: { jobs: result.data, cursor: { cursor: { type: 'none', message: 'Returns all jobs' }, strategy: 'none', exhausted: true, fetchedCount: result.data.length }, hasMore: false, meta: { totalJobs: result.data.length } }, meta: result.meta };
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const startTime = Date.now();
    try {
      await this.getAccessToken();
      return { ok: true, data: true, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: TOKEN_SCOPE,
    });

    const response = await resilientFetch(TOKEN_URL, 'france_travail_token', {}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const data = (await response.json()) as FranceTravailTokenResponse;
    // Refresh a little early (60s margin) rather than racing token expiry mid-page-loop.
    this.cachedToken = { token: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 };
    return this.cachedToken.token;
  }

  private mapOffers(offers: readonly FranceTravailOffer[]): RawJob[] {
    const now = new Date();
    return offers.map((offer) => ({
      sourceId: offer.id,
      title: offer.intitule,
      description: offer.description ?? '',
      companyName: offer.entreprise?.nom || 'Unknown',
      location: offer.lieuTravail?.libelle || 'France',
      salary: this.parseSalary(offer.salaire?.libelle),
      technologies: [],
      url: offer.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${offer.id}`,
      publishedAt: offer.dateCreation ? new Date(offer.dateCreation) : now,
      employmentType: this.mapEmploymentType(offer.typeContrat),
      fetchedAt: now,
    }));
  }

  private mapEmploymentType(typeContrat?: string): string | undefined {
    switch (typeContrat) {
      case 'CDI': return 'full_time';
      case 'CDD': return 'contract';
      case 'MIS': return 'contract';
      case 'SAI': return 'freelance';
      default: return undefined;
    }
  }

  /**
   * France Travail's salary field is a single freeform French string, e.g.
   * "Mensuel de 2400.0 Euros à 2800.0 Euros sur 12 mois" or "Annuel de
   * 35000.0 Euros à 40000.0 Euros" — best-effort parse, same posture as
   * Remotive's freeform salary parser: never guess a value we can't
   * reasonably derive rather than risk a wrong-order min/max.
   */
  private parseSalary(libelle?: string): RawJob['salary'] | undefined {
    if (!libelle) return undefined;

    const nums = [...libelle.matchAll(/(\d+(?:[.,]\d+)?)/g)]
      .map((m) => parseFloat(m[1]!.replace(',', '.')))
      .filter((n) => !isNaN(n));
    if (nums.length === 0) return undefined;

    const from = Math.min(...nums);
    const to = Math.max(...nums);
    const period = /horaire/i.test(libelle) ? 'hourly' : /annuel/i.test(libelle) ? 'yearly' : /mensuel/i.test(libelle) ? 'monthly' : 'unknown';

    return { from, to: to !== from ? to : undefined, currency: 'EUR', period };
  }
}

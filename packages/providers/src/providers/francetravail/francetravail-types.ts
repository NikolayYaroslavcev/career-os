/**
 * Response shapes for France Travail's "Offres d'emploi" v2 API
 * (`api.francetravail.io/partenaire/offresdemploi/v2/offres/search`).
 *
 * UNVERIFIED AGAINST A LIVE RESPONSE: the francetravail.io documentation
 * site is a client-rendered SPA this codebase's tooling can't execute, and
 * building a real request needs OAuth2 client credentials nobody has
 * registered yet. These field names come from the API's long-stable public
 * shape (used by numerous open-source French job-aggregator projects), and
 * both the OAuth2 token endpoint and this search endpoint were confirmed
 * live and reachable (401/invalid_client responses, not DNS/404 failures)
 * during implementation — but the exact response shape has not been
 * confirmed against a real 200 response. Validate this against a live
 * response as soon as FRANCE_TRAVAIL_CLIENT_ID/SECRET are provisioned.
 */
export interface FranceTravailOffer {
  readonly id: string;
  readonly intitule: string;
  readonly description?: string;
  readonly dateCreation?: string;
  readonly dateActualisation?: string;
  readonly lieuTravail?: { readonly libelle?: string; readonly commune?: string };
  readonly entreprise?: { readonly nom?: string };
  readonly typeContrat?: string;
  readonly typeContratLibelle?: string;
  readonly salaire?: { readonly libelle?: string };
  readonly romeCode?: string;
  readonly romeLibelle?: string;
  readonly origineOffre?: { readonly origine?: string; readonly urlOrigine?: string };
}

export interface FranceTravailSearchResponse {
  readonly resultats: readonly FranceTravailOffer[];
}

export interface FranceTravailTokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
  readonly token_type: string;
}

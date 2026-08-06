/** Typed per-ATS config. Only Greenhouse is implemented in this pass (ADR-033 Phase 1/2 pilot). */
export interface GreenhouseAdapterConfig {
  readonly boardToken: string;
  readonly baseUrl?: string;
}

/** Lever config (ADR-033 addendum: Lever migration). */
export interface LeverAdapterConfig {
  readonly company: string;
  readonly baseUrl?: string;
}

/** SmartRecruiters config (ADR-033 addendum: SmartRecruiters migration). */
export interface SmartRecruitersAdapterConfig {
  readonly company: string;
  readonly baseUrl?: string;
}

/** Recruitee config (ADR-033 addendum: Recruitee migration). */
export interface RecruiteeAdapterConfig {
  readonly company: string;
  readonly baseUrl?: string;
}

/**
 * Comeet config (ADR-033 addendum: Comeet migration). No `AtsAdapter<TConfig>`
 * class exists for Comeet — `company-watch`'s `AtsType` enum has no `COMEET`
 * value at all (unlike Recruitee/SmartRecruiters), so there is no second
 * consumer to serve; only transport + parser are shared, consumed directly by
 * `providers`' fetcher, same as Greenhouse/Lever bypass their own Adapter
 * classes.
 */
export interface ComeetAdapterConfig {
  readonly token: string;
  readonly companyUid: string;
  readonly baseUrl?: string;
}

/** Ashby config (ADR-033 addendum: Ashby migration). */
export interface AshbyAdapterConfig {
  readonly jobBoardName: string;
  readonly baseUrl?: string;
}

/** Workday config (ADR-033 addendum: Workday migration). `host` defaults to `wd1.myworkdayjobs.com`, matching providers' original `DEFAULT_HOST`. */
export interface WorkdayAdapterConfig {
  readonly tenant: string;
  readonly site: string;
  readonly host?: string;
}

/** Teamtailor config (ADR-033 addendum: Teamtailor migration). */
export interface TeamtailorAdapterConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
}

/**
 * Personio config (research/free-provider-expansion/EPIC.md Phase 1). Public,
 * unauthenticated per-tenant XML feed — `company` is the `{company}` in
 * `https://{company}.jobs.personio.de/xml`, same per-tenant-subdomain shape
 * as Workday's `tenant`. `language` selects the feed's content language
 * (de/en/fr/es/nl/it/pt per Personio's docs); defaults to `en`.
 */
export interface PersonioAdapterConfig {
  readonly company: string;
  readonly language?: string;
  readonly host?: string;
}

/**
 * Workable config (research/free-provider-expansion/EPIC.md Phase 1). Public,
 * unauthenticated per-tenant JSON widget endpoint — `accountSlug` is the
 * `{account_slug}` in `https://apply.workable.com/api/v1/widget/accounts/{account_slug}`,
 * the same public "job widget" Workable designs for customers to embed on
 * their own sites.
 */
export interface WorkableAdapterConfig {
  readonly accountSlug: string;
  readonly baseUrl?: string;
}

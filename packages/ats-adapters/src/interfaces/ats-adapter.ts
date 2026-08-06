import type { AtsRawJob } from './ats-raw-job.js';

/**
 * Shared contract both `providers`' `Fetcher` and `company-watch`'s prior
 * per-package `AtsAdapter` reduce to: call the ATS, return canonical raw
 * jobs. Consumers wrap this to translate into their own type
 * (`RawJob`/`AtsJob`) and error contract (`ProviderResult` vs. throw) — see
 * ADR-033 "Compatibility". Adapters throw typed errors (see `errors.ts`);
 * they do not return a result envelope themselves.
 */
export interface AtsAdapter<TConfig> {
  readonly atsType: string;
  fetchJobs(config: TConfig): Promise<AtsRawJob[]>;
  fetchJob(config: TConfig, externalId: string): Promise<AtsRawJob | null>;
  ping(config: TConfig): Promise<boolean>;
}

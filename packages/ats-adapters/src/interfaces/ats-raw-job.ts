/**
 * Canonical raw job shape returned by every ATS adapter — the superset of
 * fields `providers`' `RawJob` and `company-watch`'s `AtsJob` both already
 * carry (see ADR-033). Deliberately excludes `technologies`: extracting
 * technology keywords from ATS-specific metadata stays consumer-owned until
 * that logic is intentionally unified (ADR-033, out of scope for this pass).
 * `rawMetadata` carries the untouched per-ATS metadata so each consumer can
 * keep doing its own extraction against it.
 */
export interface AtsRawJobSalary {
  readonly min?: number;
  readonly max?: number;
  readonly currency?: string;
}

export interface AtsRawJob {
  readonly externalId: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly location?: string;
  readonly salary?: AtsRawJobSalary;
  readonly publishedAt?: Date;
  readonly departments?: readonly string[];
  readonly rawMetadata?: unknown;
}

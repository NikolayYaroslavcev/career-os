import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

/**
 * Structural mirror of `packages/ai`'s `ExtractedVacancyFields` — duplicated
 * rather than imported because `packages/providers` has no dependency on
 * `@careeros/career`/`@careeros/ai` (same boundary rule that keeps
 * `transportType` a plain string on `SocialMessageTransport`, see ADR-032's
 * transport-capability addendum). Only the fields this mapper actually uses
 * are declared; the composition root (apps/backend) is responsible for
 * shaping its `MessageExtraction.extractedFields` into this before returning
 * it from a `TelegramExtractionLookup`.
 */
export interface TelegramExtractedFields {
  readonly company: string | null;
  readonly title: string | null;
  readonly technologies: readonly string[];
  readonly skills: readonly string[];
  readonly seniority: string | null;
  readonly salaryMin: number | null;
  readonly salaryMax: number | null;
  readonly currency: string | null;
  readonly country: string | null;
  readonly city: string | null;
  readonly employmentType: string | null;
  readonly remoteType: string | null;
  readonly links: readonly string[];
  readonly requirements: readonly string[];
  readonly responsibilities: readonly string[];
}

/**
 * Given a Telegram channel username and a platform-native message ID, resolve
 * the confidence-gated AI extraction for that message, if one exists yet.
 * `undefined` means "not ready" (still pending/extracting) or "gated out"
 * (LOW_CONFIDENCE/SPAM/error) — TelegramFetcher.buildRawJob() treats both the
 * same way: skip this message for this sync cycle.
 */
export type TelegramExtractionLookup = (channel: string, messageId: string) => Promise<TelegramExtractedFields | undefined>;

/**
 * ADR-032 Phase 4/5 — the V2 half of the Mapper/Normalizer swap described in
 * the ADR's migration table. Implements the exact same `Mapper` interface V1's
 * `TelegramMapper` does, but the RawJob it receives was already built by
 * `TelegramFetcher.buildRawJob()` from AI-extracted fields (via
 * `TelegramExtractionLookup`) rather than regex — so this class does no
 * extraction of its own, only shape/whitespace normalization identical to
 * V1's, to keep behavior comparable across the cutover.
 */
export class SocialMessageMapper implements Mapper {
  readonly providerId = 'telegram';

  map(raw: RawJob): MappedJob {
    return {
      sourceId: raw.sourceId,
      title: this.normalizeWhitespace(raw.title),
      description: raw.description.replace(/[ \t]+/g, ' ').trim(),
      companyName: this.normalizeCompanyName(raw.companyName),
      companySourceId: raw.companySourceId,
      location: this.normalizeLocation(raw.location),
      salary: this.normalizeSalary(raw.salary),
      experienceLevel: raw.experienceLevel,
      technologies: [...new Set(raw.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean))],
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
      employmentType: raw.employmentType,
      extensions: raw.extensions,
    };
  }

  private normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private normalizeCompanyName(companyName: string): string {
    const trimmed = companyName.replace(/\s+/g, ' ').trim();
    return trimmed || 'Unknown';
  }

  private normalizeLocation(location: string): MappedJob['location'] {
    if (!location || !location.trim()) {
      return { raw: 'Не указано' };
    }
    return { raw: location, city: location };
  }

  private normalizeSalary(salary: RawJob['salary']): MappedJob['salary'] | undefined {
    if (!salary || (!salary.from && !salary.to)) {
      return undefined;
    }
    return { min: salary.from, max: salary.to, currency: salary.currency, period: salary.period };
  }
}

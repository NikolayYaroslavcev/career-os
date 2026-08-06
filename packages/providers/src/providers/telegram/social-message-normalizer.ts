import type { Normalizer, NormalizationError } from '../../interfaces/normalizer.js';
import type { MappedJob } from '../../interfaces/mapper.js';
import type { NormalizedVacancy } from '../../interfaces/normalized-vacancy.js';
import type { VacancySource } from '../../types/provider.js';
import { DefaultNormalizationPipeline } from '../../normalization/normalization-pipeline.js';

/**
 * ADR-032 Phase 4/5 — the V2 half of the Mapper/Normalizer swap. Reuses
 * `DefaultNormalizationPipeline` exactly like V1's `TelegramNormalizer` did:
 * by the time a `MappedJob` reaches here its fields already came from the
 * AI extraction (via `SocialMessageMapper`), so there's no second,
 * bespoke normalization path to maintain — same pipeline every other
 * provider's normalizer uses, just fed already-structured input instead of
 * regex output.
 */
export class SocialMessageNormalizer implements Normalizer {
  readonly providerId: VacancySource = 'telegram';
  private readonly pipeline = new DefaultNormalizationPipeline();

  normalize(job: MappedJob): NormalizedVacancy {
    return this.pipeline.normalize(this.providerId, job);
  }

  validate(job: MappedJob): NormalizationError | null {
    if (!job.sourceId) return { field: 'sourceId', message: 'Missing sourceId', severity: 'error' };
    if (!job.title?.trim()) return { field: 'title', message: 'Missing title', severity: 'error' };
    if (!job.url?.trim()) return { field: 'url', message: 'Missing URL', severity: 'error' };
    if (!job.publishedAt) return { field: 'publishedAt', message: 'Missing date', severity: 'error' };
    return null;
  }
}

import type { Normalizer, NormalizationError } from '../../interfaces/normalizer.js';
import type { MappedJob } from '../../interfaces/mapper.js';
import type { NormalizedVacancy } from '../../interfaces/normalized-vacancy.js';
import type { VacancySource } from '../../types/provider.js';
import { DefaultNormalizationPipeline } from '../../normalization/normalization-pipeline.js';

export class TelegramNormalizer implements Normalizer {
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

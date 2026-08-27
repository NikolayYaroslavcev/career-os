import type { Normalizer, NormalizationError } from '../../interfaces/normalizer.js';
import type { MappedJob } from '../../interfaces/mapper.js';
import type { NormalizedVacancy } from '../../interfaces/normalized-vacancy.js';
import type { VacancySource } from '../../types/provider.js';
import { DefaultNormalizationPipeline } from '../../normalization/normalization-pipeline.js';

export class JustJoinItNormalizer implements Normalizer {
  readonly providerId: VacancySource = 'justjoin_it';
  private readonly pipeline = new DefaultNormalizationPipeline();

  normalize(job: MappedJob): NormalizedVacancy {
    return this.pipeline.normalize(this.providerId, job);
  }

  validate(job: MappedJob): NormalizationError | null {
    if (!job.sourceId) return { field: 'sourceId', message: 'Missing sourceId', severity: 'error' };
    if (!job.title?.trim()) return { field: 'title', message: 'Missing or empty title', severity: 'error' };
    if (!job.companyName?.trim()) return { field: 'companyName', message: 'Missing or empty company name', severity: 'error' };
    if (!job.url?.trim()) return { field: 'url', message: 'Missing or empty URL', severity: 'error' };
    if (!job.publishedAt) return { field: 'publishedAt', message: 'Missing publishedAt', severity: 'error' };
    return null;
  }
}

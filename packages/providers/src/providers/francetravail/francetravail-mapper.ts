import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';
import { extractTechnologiesFromText } from '../../shared/tech-keywords.js';

export class FranceTravailMapper implements Mapper {
  readonly providerId = 'france_travail';

  map(raw: RawJob): MappedJob {
    const title = decodeHtmlEntities(raw.title).replace(/\s+/g, ' ').trim();
    const description = decodeHtmlEntities(raw.description).replace(/\s+/g, ' ').trim();

    return {
      sourceId: raw.sourceId,
      title,
      description,
      companyName: decodeHtmlEntities(raw.companyName).replace(/\s+/g, ' ').trim(),
      location: { raw: raw.location || 'France', country: 'France' },
      salary: raw.salary ? { min: raw.salary.from, max: raw.salary.to, currency: raw.salary.currency, period: raw.salary.period } : undefined,
      technologies: extractTechnologiesFromText(`${title} ${description}`),
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      employmentType: raw.employmentType,
    };
  }
}

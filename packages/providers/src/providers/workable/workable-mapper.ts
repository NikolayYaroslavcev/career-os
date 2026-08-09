import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities, decodeTechnologies } from '../../shared/html-entities.js';

export class WorkableMapper implements Mapper {
  readonly providerId = 'workable';

  map(raw: RawJob): MappedJob {
    return {
      sourceId: raw.sourceId,
      title: decodeHtmlEntities(raw.title).trim(),
      description: decodeHtmlEntities(raw.description.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(),
      companyName: decodeHtmlEntities(raw.companyName).trim(),
      companySourceId: raw.companySourceId,
      location: this.splitLocation(raw.location),
      salary: raw.salary
        ? { min: raw.salary.from, max: raw.salary.to, currency: raw.salary.currency, period: raw.salary.period }
        : undefined,
      // Structured fields from the widget response, not free-text inference
      // — see workable-fetcher.ts's EXPERIENCE_MAP/mapEmploymentType.
      experienceLevel: raw.experienceLevel,
      employmentType: raw.employmentType,
      technologies: decodeTechnologies(raw.technologies),
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
      extensions: raw.extensions,
    };
  }

  private splitLocation(location: string): MappedJob['location'] {
    if (!location) {
      return { raw: 'Not specified' };
    }

    const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
    const city = parts[0];
    const country = parts.length > 1 ? parts[parts.length - 1] : undefined;

    return { raw: location, city, country };
  }
}

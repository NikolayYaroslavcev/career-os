import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';

export class HNHiringMapper implements Mapper {
  readonly providerId = 'hn_hiring';

  map(raw: RawJob): MappedJob {
    const locationParts = (raw.location || 'Remote').split(',').map((p) => p.trim());
    return {
      sourceId: raw.sourceId,
      title: decodeHtmlEntities(raw.title).replace(/\s+/g, ' ').trim(),
      description: decodeHtmlEntities(raw.description.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(),
      companyName: decodeHtmlEntities(raw.companyName).replace(/\s+/g, ' ').trim(),
      location: { raw: raw.location || 'Remote', city: locationParts[0], country: locationParts.length > 1 ? locationParts[locationParts.length - 1] : undefined },
      technologies: [...new Set(raw.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean))],
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
    };
  }
}

import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';

export class NoDeskMapper implements Mapper {
  readonly providerId = 'nodesk';

  map(raw: RawJob): MappedJob {
    return {
      sourceId: raw.sourceId,
      title: decodeHtmlEntities(raw.title).replace(/\s+/g, ' ').trim(),
      description: decodeHtmlEntities(raw.description.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(),
      companyName: decodeHtmlEntities(raw.companyName).replace(/\s+/g, ' ').trim(),
      location: { raw: raw.location || 'Remote' },
      technologies: [...new Set(raw.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean))],
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: true,
    };
  }
}

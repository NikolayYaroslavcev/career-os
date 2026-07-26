import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class HNHiringMapper implements Mapper {
  readonly providerId = 'hn_hiring';

  map(raw: RawJob): MappedJob {
    const locationParts = (raw.location || 'Remote').split(',').map((p) => p.trim());
    return {
      sourceId: raw.sourceId,
      title: raw.title.replace(/\s+/g, ' ').trim(),
      description: raw.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(),
      companyName: raw.companyName.replace(/\s+/g, ' ').trim(),
      location: { raw: raw.location || 'Remote', city: locationParts[0], country: locationParts.length > 1 ? locationParts[locationParts.length - 1] : undefined },
      technologies: [...new Set(raw.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean))],
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
    };
  }
}

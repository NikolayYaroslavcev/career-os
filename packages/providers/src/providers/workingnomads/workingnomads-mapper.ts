import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class WorkingNomadsMapper implements Mapper {
  readonly providerId = 'working_nomads';

  map(raw: RawJob): MappedJob {
    return {
      sourceId: raw.sourceId,
      title: (raw.title ?? '').replace(/\s+/g, ' ').trim(),
      description: (raw.description || raw.title || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
      companyName: (raw.companyName ?? '').replace(/\s+/g, ' ').trim(),
      location: { raw: raw.location || 'Remote' },
      technologies: [...new Set(raw.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean))],
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: true,
    };
  }
}

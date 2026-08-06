import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';
import { extractTechnologiesFromText } from '../../shared/tech-keywords.js';

export class DjangoJobsMapper implements Mapper {
  readonly providerId = 'django_jobs';

  map(raw: RawJob): MappedJob {
    const title = decodeHtmlEntities(raw.title).replace(/\s+/g, ' ').trim();
    const description = decodeHtmlEntities(raw.description.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

    // Every listing on this board is, by definition, a Django role.
    const technologies = new Set(extractTechnologiesFromText(`${title} ${description}`));
    technologies.add('django');
    technologies.add('python');

    return {
      sourceId: raw.sourceId,
      title,
      description,
      companyName: decodeHtmlEntities(raw.companyName).replace(/\s+/g, ' ').trim(),
      location: { raw: raw.location || 'Unknown' },
      technologies: [...technologies],
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
    };
  }
}

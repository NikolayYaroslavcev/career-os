import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';
import { extractTechnologiesFromText } from '../../shared/tech-keywords.js';

export class PyJobsMapper implements Mapper {
  readonly providerId = 'pyjobs';

  map(raw: RawJob): MappedJob {
    const title = decodeHtmlEntities(raw.title).replace(/\s+/g, ' ').trim();
    const description = decodeHtmlEntities(raw.description).replace(/\s+/g, ' ').trim();

    // Every listing on PyJobs is, by definition, a Python role — the board
    // has no other language focus — so 'python' is always a safe tag even
    // when the title/description text doesn't spell it out.
    const technologies = new Set(extractTechnologiesFromText(`${title} ${description}`));
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
      employmentType: raw.employmentType,
    };
  }
}

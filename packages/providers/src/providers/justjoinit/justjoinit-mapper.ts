import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { extractTechnologiesFromText } from '../../shared/tech-keywords.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';

export class JustJoinItMapper implements Mapper {
  readonly providerId = 'justjoin_it';

  map(raw: RawJob): MappedJob {
    const title = decodeHtmlEntities(raw.title);
    const description = decodeHtmlEntities(raw.description);
    const companyName = decodeHtmlEntities(raw.companyName);
    const locationParts = raw.location.split(',').map((p) => p.trim());
    const technologies = extractTechnologiesFromText(`${title} ${description}`);

    return {
      sourceId: raw.sourceId,
      title,
      description,
      companyName,
      companyUrl: raw.companyUrl,
      location: {
        raw: raw.location,
        city: locationParts[0],
        country: locationParts.length > 1 ? locationParts[locationParts.length - 1] : undefined,
      },
      salary: raw.salary ? { min: raw.salary.from, max: raw.salary.to, currency: raw.salary.currency, period: raw.salary.period } : undefined,
      technologies,
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
      employmentType: raw.employmentType,
    };
  }
}

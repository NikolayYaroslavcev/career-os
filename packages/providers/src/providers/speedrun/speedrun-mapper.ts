import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';
import { extractTechnologiesFromText } from '../../shared/tech-keywords.js';

export class SpeedrunMapper implements Mapper {
  readonly providerId = 'speedrun';

  map(raw: RawJob): MappedJob {
    const title = decodeHtmlEntities(raw.title).replace(/\s+/g, ' ').trim();
    // No job-description text is available from the list endpoint (only the
    // per-job detail endpoint has it, and fetching that per job would mean
    // ~6,000 extra requests per sync) — the fetcher already composed a short,
    // honest summary from real structured fields (company/seniority/
    // employment type/workplace/location) rather than fabricating prose.
    const description = decodeHtmlEntities(raw.description).replace(/\s+/g, ' ').trim();

    return {
      sourceId: raw.sourceId,
      title,
      description,
      companyName: decodeHtmlEntities(raw.companyName).replace(/\s+/g, ' ').trim(),
      location: { raw: raw.location || 'Unknown' },
      salary: raw.salary ? { min: raw.salary.from, max: raw.salary.to, currency: raw.salary.currency, period: raw.salary.period } : undefined,
      experienceLevel: raw.experienceLevel,
      technologies: extractTechnologiesFromText(title),
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
      employmentType: raw.employmentType,
    };
  }
}

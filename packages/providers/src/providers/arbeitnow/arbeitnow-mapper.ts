import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class ArbeitnowMapper implements Mapper {
  readonly providerId = 'arbeitnow';

  map(raw: RawJob): MappedJob {
    const title = raw.title.replace(/\s+/g, ' ').trim();
    const description = raw.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const combined = `${title} ${description}`.toLowerCase();
    let experienceLevel: string | undefined;
    if (/\b(intern)\b/i.test(combined)) experienceLevel = 'intern';
    else if (/\b(junior)\b/i.test(combined)) experienceLevel = 'junior';
    else if (/\b(middle)\b/i.test(combined)) experienceLevel = 'middle';
    else if (/\b(senior)\b/i.test(combined)) experienceLevel = 'senior';
    else if (/\b(lead)\b/i.test(combined)) experienceLevel = 'lead';

    let employmentType: string | undefined;
    if (/\b(full[\s-]?time)\b/i.test(combined)) employmentType = 'full_time';
    else if (/\b(part[\s-]?time)\b/i.test(combined)) employmentType = 'part_time';
    else if (/\b(contract)\b/i.test(combined)) employmentType = 'contract';
    else if (/\b(freelance)\b/i.test(combined)) employmentType = 'freelance';

    const locationParts = (raw.location || 'Remote').split(',').map((p) => p.trim());
    return {
      sourceId: raw.sourceId, title, description,
      companyName: raw.companyName.replace(/\s+/g, ' ').trim(),
      location: { raw: raw.location || 'Remote', city: locationParts[0], country: locationParts.length > 1 ? locationParts[locationParts.length - 1] : undefined },
      experienceLevel, technologies: [...new Set(raw.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean))],
      url: raw.url, publishedAt: raw.publishedAt, fetchedAt: raw.fetchedAt, remote: raw.remote, employmentType,
    };
  }
}

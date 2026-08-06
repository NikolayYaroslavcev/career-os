import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';

export class RemotiveMapper implements Mapper {
  readonly providerId = 'remotive';

  map(raw: RawJob): MappedJob {
    return {
      sourceId: raw.sourceId,
      title: decodeHtmlEntities(raw.title ?? '').replace(/\s+/g, ' ').trim(),
      description: this.stripHtml(raw.description ?? ''),
      companyName: decodeHtmlEntities(raw.companyName ?? '').replace(/\s+/g, ' ').trim(),
      location: this.parseLocation(raw.location),
      salary: raw.salary ? { min: raw.salary.from, max: raw.salary.to, currency: raw.salary.currency, period: raw.salary.period } : undefined,
      experienceLevel: this.inferExperienceLevel(raw.title, raw.description),
      technologies: [...new Set(raw.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean))],
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
      employmentType: this.inferEmploymentType(raw.title, raw.description, raw.extensions?.jobType as string),
      extensions: raw.extensions,
    };
  }

  private stripHtml(html: string): string {
    return decodeHtmlEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  }

  private parseLocation(location: string): MappedJob['location'] {
    if (!location) return { raw: 'Remote' };
    const parts = location.split(',').map((p) => p.trim());
    return { raw: location, city: parts[0], country: parts.length > 1 ? parts[parts.length - 1] : undefined };
  }

  private inferExperienceLevel(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();
    if (/\b(intern|стажёр|стажер)\b/i.test(combined)) return 'intern';
    if (/\b(junior|младший)\b/i.test(combined)) return 'junior';
    if (/\b(middle|средний)\b/i.test(combined)) return 'middle';
    if (/\b(senior|старший)\b/i.test(combined)) return 'senior';
    if (/\b(lead|руководитель)\b/i.test(combined)) return 'lead';
    if (/\b(principal|главный)\b/i.test(combined)) return 'principal';
    return undefined;
  }

  private inferEmploymentType(title: string, description: string, jobType?: string): string | undefined {
    const combined = `${title} ${description} ${jobType ?? ''}`.toLowerCase();
    if (/\b(full[\s-]?time)\b/i.test(combined)) return 'full_time';
    if (/\b(part[\s-]?time)\b/i.test(combined)) return 'part_time';
    if (/\b(contract)\b/i.test(combined)) return 'contract';
    if (/\b(freelance)\b/i.test(combined)) return 'freelance';
    if (/\b(intern)\b/i.test(combined)) return 'internship';
    return undefined;
  }
}

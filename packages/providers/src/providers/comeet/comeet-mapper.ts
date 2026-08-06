import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';

export class ComeetMapper implements Mapper {
  readonly providerId = 'comeet';
  private readonly companyName: string;

  constructor(companyName: string) {
    this.companyName = companyName;
  }

  map(raw: RawJob): MappedJob {
    const title = this.normalizeTitle(raw.title);
    const description = this.normalizeDescription(raw.description);
    const companyName = this.companyName;
    const location = this.normalizeLocation(raw.location);
    const salary = this.normalizeSalary(raw.salary);
    const technologies = this.extractTechnologies(description);

    return {
      sourceId: raw.sourceId,
      title,
      description,
      companyName,
      location,
      salary,
      experienceLevel: this.inferExperienceLevel(title, description),
      technologies,
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote ?? false,
      employmentType: this.inferEmploymentType(raw.extensions),
      extensions: raw.extensions,
    };
  }

  private normalizeTitle(title: string): string {
    return decodeHtmlEntities(title)
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeDescription(description: string): string {
    return decodeHtmlEntities(description.replace(/<[^>]*>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeLocation(location: string): MappedJob['location'] {
    if (!location) {
      return { raw: 'Unknown' };
    }

    const parts = location.split(',').map((p) => p.trim());
    const city = parts[0];
    const country = parts.length > 1 ? parts[parts.length - 1] : undefined;

    return {
      raw: location,
      city,
      country,
    };
  }

  private normalizeSalary(salary: RawJob['salary']): MappedJob['salary'] | undefined {
    if (!salary || (salary.from === undefined && salary.to === undefined)) {
      return undefined;
    }

    return {
      min: salary.from,
      max: salary.to,
      currency: salary.currency,
      period: salary.period,
    };
  }

  private extractTechnologies(description: string): string[] {
    const techPatterns = [
      /\b(python|javascript|typescript|java|c\+\+|c#|ruby|go|rust|php|swift|kotlin)\b/gi,
      /\b(react|angular|vue|node\.?js|next\.?js|nuxt|django|flask|spring|rails|laravel|express)\b/gi,
      /\b(aws|azure|gcp|docker|kubernetes|terraform|ci\/cd|git)\b/gi,
      /\b(postgresql|mysql|mongodb|redis|elasticsearch|sql)\b/gi,
    ];

    const technologies = new Set<string>();

    for (const pattern of techPatterns) {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        const tech = match[1];
        if (tech) {
          technologies.add(tech.toLowerCase());
        }
      }
    }

    return [...technologies];
  }

  private inferExperienceLevel(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    if (/\b(intern|placement)\b/i.test(combined)) return 'intern';
    if (/\b(junior|graduate)\b/i.test(combined)) return 'junior';
    if (/\b(middle|mid[\s-]?level)\b/i.test(combined)) return 'middle';
    if (/\b(senior|sr\.?)\b/i.test(combined)) return 'senior';
    if (/\b(lead|principal|staff)\b/i.test(combined)) return 'lead';

    return undefined;
  }

  private inferEmploymentType(extensions?: Record<string, unknown>): string | undefined {
    if (!extensions) return undefined;

    const apiType = extensions['employmentType'] as string | undefined;
    if (apiType) {
      const type = apiType.toLowerCase();
      if (type.includes('full')) return 'full_time';
      if (type.includes('part')) return 'part_time';
      if (type.includes('contract')) return 'contract';
      if (type.includes('intern')) return 'internship';
      if (type.includes('freelance')) return 'freelance';
    }

    return undefined;
  }
}

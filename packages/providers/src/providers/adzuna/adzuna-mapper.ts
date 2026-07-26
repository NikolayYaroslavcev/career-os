import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class AdzunaMapper implements Mapper {
  readonly providerId = 'adzuna';

  map(raw: RawJob): MappedJob {
    const title = this.normalizeTitle(raw.title);
    const description = this.normalizeDescription(raw.description);
    const companyName = this.normalizeCompanyName(raw.companyName);
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
      remote: false,
      employmentType: this.inferEmploymentType(raw.extensions),
      extensions: raw.extensions,
    };
  }

  private normalizeTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeDescription(description: string): string {
    return description
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeCompanyName(companyName: string): string {
    return companyName
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

    if (/\b(intern|placement)\b/i.test(combined)) {
      return 'intern';
    }
    if (/\b(junior|graduate)\b/i.test(combined)) {
      return 'junior';
    }
    if (/\b(middle|mid[\s-]?level)\b/i.test(combined)) {
      return 'middle';
    }
    if (/\b(senior|sr\.?)\b/i.test(combined)) {
      return 'senior';
    }
    if (/\b(lead|principal|staff)\b/i.test(combined)) {
      return 'lead';
    }

    return undefined;
  }

  private inferEmploymentType(extensions: Record<string, unknown> | undefined): string | undefined {
    if (!extensions) return undefined;

    const contractType = extensions['contractType'] as string | undefined;
    const contractTime = extensions['contractTime'] as string | undefined;

    if (contractTime === 'full_time') return 'full_time';
    if (contractTime === 'part_time') return 'part_time';
    if (contractType === 'contract') return 'contract';
    if (contractType === 'permanent') return 'full_time';

    return undefined;
  }
}

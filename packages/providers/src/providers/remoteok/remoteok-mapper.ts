import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class RemoteOKMapper implements Mapper {
  readonly providerId = 'remote_ok';

  map(raw: RawJob): MappedJob {
    const title = this.normalizeTitle(raw.title);
    const description = this.normalizeDescription(raw.description);
    const companyName = this.normalizeCompanyName(raw.companyName);
    const location = this.normalizeLocation(raw.location);
    const salary = this.normalizeSalary(raw.salary);
    const technologies = this.normalizeTechnologies(raw.technologies);

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
      remote: raw.remote,
      employmentType: this.inferEmploymentType(title, description),
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
      return { raw: 'Remote' };
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
    if (!salary || (salary.from === 0 && salary.to === 0)) {
      return undefined;
    }

    return {
      min: salary.from,
      max: salary.to,
      currency: salary.currency,
      period: salary.period,
    };
  }

  private normalizeTechnologies(technologies: readonly string[]): string[] {
    return [...new Set(
      technologies
        .map((t) => t.toLowerCase().trim())
        .filter((t) => t.length > 0),
    )];
  }

  private inferExperienceLevel(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    if (/\b(intern|стажёр|стажер)\b/i.test(combined)) {
      return 'intern';
    }
    if (/\b(junior|младший)\b/i.test(combined)) {
      return 'junior';
    }
    if (/\b(middle|средний)\b/i.test(combined)) {
      return 'middle';
    }
    if (/\b(senior|старший)\b/i.test(combined)) {
      return 'senior';
    }
    if (/\b(lead|руководитель)\b/i.test(combined)) {
      return 'lead';
    }
    if (/\b(principal|главный)\b/i.test(combined)) {
      return 'principal';
    }

    return undefined;
  }

  private inferEmploymentType(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    if (/\b(full[\s-]?time)\b/i.test(combined)) {
      return 'full_time';
    }
    if (/\b(part[\s-]?time)\b/i.test(combined)) {
      return 'part_time';
    }
    if (/\b(contract)\b/i.test(combined)) {
      return 'contract';
    }
    if (/\b(freelance)\b/i.test(combined)) {
      return 'freelance';
    }
    if (/\b(intern)\b/i.test(combined)) {
      return 'internship';
    }

    return undefined;
  }
}
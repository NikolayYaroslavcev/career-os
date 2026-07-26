import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class SJMapper implements Mapper {
  readonly providerId = 'superjob';

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
      companySourceId: raw.companySourceId,
      location,
      salary,
      experienceLevel: raw.experienceLevel ?? this.inferExperienceLevel(title, description),
      technologies,
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
      employmentType: raw.employmentType ?? this.inferEmploymentType(title, description),
      extensions: raw.extensions,
    };
  }

  private normalizeTitle(title: string): string {
    return title.replace(/\s+/g, ' ').trim();
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
    return companyName.replace(/\s+/g, ' ').trim();
  }

  private normalizeLocation(location: string): MappedJob['location'] {
    if (!location || location === 'Не указано') {
      return { raw: 'Не указано' };
    }

    return {
      raw: location,
      city: location,
      country: 'Россия',
    };
  }

  private normalizeSalary(salary: RawJob['salary']): MappedJob['salary'] | undefined {
    if (!salary || (!salary.from && !salary.to)) {
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
      technologies.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 0),
    )];
  }

  private inferExperienceLevel(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    // Unicode-aware boundaries — plain `\b` never matches around Cyrillic
    // words (see hh-mapper.ts for the same fix, same root cause).
    if (/(?<!\p{L})(intern|стажёр|стажер|internship)(?!\p{L})/iu.test(combined)) {
      return 'intern';
    }
    if (/(?<!\p{L})(junior|младший|jun)(?!\p{L})/iu.test(combined)) {
      return 'junior';
    }
    if (/(?<!\p{L})(middle|средний|mid)(?!\p{L})/iu.test(combined)) {
      return 'middle';
    }
    if (/(?<!\p{L})(senior|старший|sr)(?!\p{L})/iu.test(combined)) {
      return 'senior';
    }
    if (/(?<!\p{L})(lead|руководитель|team lead)(?!\p{L})/iu.test(combined)) {
      return 'lead';
    }
    if (/(?<!\p{L})(principal|главный|staff)(?!\p{L})/iu.test(combined)) {
      return 'principal';
    }

    return undefined;
  }

  private inferEmploymentType(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    if (/(?<!\p{L})(full[\s-]?time|полная\s*занятость)(?!\p{L})/iu.test(combined)) {
      return 'full_time';
    }
    if (/(?<!\p{L})(part[\s-]?time|частичная\s*занятость)(?!\p{L})/iu.test(combined)) {
      return 'part_time';
    }
    if (/(?<!\p{L})(contract|контракт)(?!\p{L})/iu.test(combined)) {
      return 'contract';
    }
    if (/(?<!\p{L})(freelance|фриланс)(?!\p{L})/iu.test(combined)) {
      return 'freelance';
    }
    if (/(?<!\p{L})(intern|стажировка)(?!\p{L})/iu.test(combined)) {
      return 'internship';
    }

    return undefined;
  }
}

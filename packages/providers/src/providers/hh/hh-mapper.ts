import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class HHMapper implements Mapper {
  readonly providerId = 'hh';

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
      return { raw: 'Не указано' };
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
      technologies
        .map((t) => t.toLowerCase().trim())
        .filter((t) => t.length > 0),
    )];
  }

  private inferExperienceLevel(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    // Plain `\b` word boundaries only recognize ASCII word characters, so they
    // never match around Cyrillic words (both sides look like "non-word" to
    // the regex engine) — every RU-language title/description silently failed
    // to match here. `(?<!\p{L})`/`(?!\p{L})` with the `u` flag are
    // Unicode-aware boundaries that work for both alphabets.
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

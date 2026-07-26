import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class TelegramMapper implements Mapper {
  readonly providerId = 'telegram';

  map(raw: RawJob): MappedJob {
    const title = this.normalizeTitle(raw.title);
    const description = this.normalizeDescription(raw.description);
    const companyName = this.normalizeCompanyName(raw.companyName);

    return {
      sourceId: raw.sourceId,
      title,
      description,
      companyName,
      companySourceId: raw.companySourceId,
      location: this.normalizeLocation(raw.location),
      salary: this.normalizeSalary(raw.salary),
      experienceLevel: raw.experienceLevel ?? this.inferExperienceLevel(title, description),
      technologies: [...new Set(raw.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean))],
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
    return description.replace(/[ \t]+/g, ' ').trim();
  }

  private normalizeCompanyName(companyName: string): string {
    const trimmed = companyName.replace(/\s+/g, ' ').trim();
    return trimmed || 'Unknown';
  }

  private normalizeLocation(location: string): MappedJob['location'] {
    if (!location || !location.trim()) {
      return { raw: 'Не указано' };
    }
    return { raw: location, city: location };
  }

  private normalizeSalary(salary: RawJob['salary']): MappedJob['salary'] | undefined {
    if (!salary || (!salary.from && !salary.to)) {
      return undefined;
    }
    return { min: salary.from, max: salary.to, currency: salary.currency, period: salary.period };
  }

  // Same Unicode-aware boundary approach as hh-mapper.ts/habr-career-mapper.ts
  // — plain `\b` never matches around Cyrillic words.
  private inferExperienceLevel(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    if (/(?<!\p{L})(intern|стажёр|стажер|internship)(?!\p{L})/iu.test(combined)) return 'intern';
    if (/(?<!\p{L})(junior|младший|jun)(?!\p{L})/iu.test(combined)) return 'junior';
    if (/(?<!\p{L})(middle|средний|mid)(?!\p{L})/iu.test(combined)) return 'middle';
    if (/(?<!\p{L})(senior|старший|sr)(?!\p{L})/iu.test(combined)) return 'senior';
    if (/(?<!\p{L})(lead|руководитель|team lead)(?!\p{L})/iu.test(combined)) return 'lead';
    if (/(?<!\p{L})(principal|главный|staff)(?!\p{L})/iu.test(combined)) return 'principal';

    return undefined;
  }

  private inferEmploymentType(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    if (/(?<!\p{L})(full[\s-]?time|полная\s*занятость|fulltime)(?!\p{L})/iu.test(combined)) return 'full_time';
    if (/(?<!\p{L})(part[\s-]?time|частичная\s*занятость|parttime)(?!\p{L})/iu.test(combined)) return 'part_time';
    if (/(?<!\p{L})(contract|контракт)(?!\p{L})/iu.test(combined)) return 'contract';
    if (/(?<!\p{L})(freelance|фриланс)(?!\p{L})/iu.test(combined)) return 'freelance';
    if (/(?<!\p{L})(internship|стажировка)(?!\p{L})/iu.test(combined)) return 'internship';

    return undefined;
  }
}

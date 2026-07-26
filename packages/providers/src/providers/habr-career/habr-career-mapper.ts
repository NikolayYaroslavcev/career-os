import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class HabrCareerMapper implements Mapper {
  readonly providerId = 'habr_career';

  map(raw: RawJob): MappedJob {
    const title = raw.title.replace(/\s+/g, ' ').trim();
    const description = raw.description.replace(/\s+/g, ' ').trim();

    return {
      sourceId: raw.sourceId,
      title,
      description,
      companyName: raw.companyName.replace(/\s+/g, ' ').trim(),
      location: this.normalizeLocation(raw.location),
      salary: this.normalizeSalary(raw.salary),
      experienceLevel: raw.experienceLevel ?? this.inferExperienceLevel(title, description),
      technologies: [...new Set(raw.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean))],
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
    };
  }

  private normalizeLocation(location: string): MappedJob['location'] {
    if (!location) {
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

  // Same Unicode-aware boundary approach as hh-mapper.ts — plain `\b` never
  // matches around Cyrillic words.
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
}

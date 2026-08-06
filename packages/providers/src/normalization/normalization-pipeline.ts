import type { MappedJob } from '../interfaces/mapper.js';
import type { NormalizedVacancy } from '../interfaces/normalized-vacancy.js';
import type { ExperienceLevel, EmploymentType } from '../types/vacancy.js';

export interface NormalizationPipeline {
  normalize(providerId: string, job: MappedJob): NormalizedVacancy;
}

export class DefaultNormalizationPipeline implements NormalizationPipeline {
  // Plain `\b` word boundaries only recognize ASCII word characters, so they
  // never match around Cyrillic words — every RU-language title/description
  // silently failed to infer here. `(?<!\p{L})`/`(?!\p{L})` with the `u` flag
  // are Unicode-aware boundaries that work for both alphabets.
  private readonly experienceLevels: Array<{ pattern: RegExp; level: ExperienceLevel }> = [
    { pattern: /(?<!\p{L})(intern|стажёр|стажер)(?!\p{L})/iu, level: 'intern' },
    { pattern: /(?<!\p{L})(junior|младший)(?!\p{L})/iu, level: 'junior' },
    { pattern: /(?<!\p{L})(middle|средний)(?!\p{L})/iu, level: 'middle' },
    { pattern: /(?<!\p{L})(senior|старший)(?!\p{L})/iu, level: 'senior' },
    { pattern: /(?<!\p{L})(lead|руководитель)(?!\p{L})/iu, level: 'lead' },
    { pattern: /(?<!\p{L})(principal|главный)(?!\p{L})/iu, level: 'principal' },
  ];

  private readonly employmentTypes: Array<{ pattern: RegExp; type: EmploymentType }> = [
    { pattern: /(?<!\p{L})(full[\s-]?time|полная?\s*занятость)(?!\p{L})/iu, type: 'full_time' },
    { pattern: /(?<!\p{L})(part[\s-]?time|частичная\s*занятость)(?!\p{L})/iu, type: 'part_time' },
    { pattern: /(?<!\p{L})(contract|контракт)(?!\p{L})/iu, type: 'contract' },
    { pattern: /(?<!\p{L})(freelance|фриланс)(?!\p{L})/iu, type: 'freelance' },
    { pattern: /(?<!\p{L})(intern|стажировк)(?!\p{L})/iu, type: 'internship' },
  ];

  normalize(providerId: string, job: MappedJob): NormalizedVacancy {
    const id = `${providerId}:${job.sourceId}`;
    const title = this.normalizeText(job.title);
    const description = this.normalizeText(job.description);
    const companyName = this.normalizeText(job.companyName);

    const experienceLevel = job.experienceLevel as ExperienceLevel | undefined
      ?? this.inferExperienceLevel(title, description);

    const employmentType = job.employmentType as EmploymentType | undefined
      ?? this.inferEmploymentType(title, description);

    const remote = this.normalizeRemote(job.remote);
    const location = this.normalizeLocation(job.location, remote);
    const salary = job.salary ? this.normalizeSalary(job.salary) : undefined;

    const technologies = [...new Set(
      job.technologies.map((t) => t.toLowerCase().trim()).filter(Boolean),
    )];

    const contentHash = this.generateContentHash({
      title,
      companyName,
      location: location.raw,
      url: job.url,
    });

    return {
      id,
      source: providerId,
      sourceId: job.sourceId,
      title,
      description,
      companyName,
      companySourceId: job.companySourceId,
      companyUrl: job.companyUrl,
      location,
      salary,
      experienceLevel,
      technologies,
      url: job.url,
      publishedAt: job.publishedAt,
      fetchedAt: job.fetchedAt,
      remote,
      employmentType,
      normalizedAt: new Date(),
      contentHash,
    };
  }

  private normalizeText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private inferExperienceLevel(title: string, description: string): ExperienceLevel | undefined {
    const combined = `${title} ${description}`.toLowerCase();
    for (const { pattern, level } of this.experienceLevels) {
      if (pattern.test(combined)) return level;
    }
    return undefined;
  }

  private inferEmploymentType(title: string, description: string): EmploymentType | undefined {
    const combined = `${title} ${description}`.toLowerCase();
    for (const { pattern, type } of this.employmentTypes) {
      if (pattern.test(combined)) return type;
    }
    return undefined;
  }

  private normalizeRemote(remote?: boolean): NormalizedVacancy['remote'] {
    if (remote === true) {
      return { level: 'remote_only', explicit: true };
    }
    if (remote === false) {
      return { level: 'unknown', explicit: true };
    }
    return { level: 'unknown', explicit: false };
  }

  private normalizeLocation(
    location: MappedJob['location'],
    remote: NormalizedVacancy['remote'],
  ): NormalizedVacancy['location'] {
    return {
      raw: location.raw,
      city: location.city,
      country: location.country,
      remoteEligible: remote.level === 'remote_only' || remote.level === 'hybrid',
    };
  }

  private normalizeSalary(salary: MappedJob['salary']): NormalizedVacancy['salary'] {
    if (!salary) return undefined;

    return {
      min: salary.min,
      max: salary.max,
      originalCurrency: salary.currency !== 'USD' ? salary.currency : undefined,
      originalMin: salary.currency !== 'USD' ? salary.min : undefined,
      originalMax: salary.currency !== 'USD' ? salary.max : undefined,
      period: 'monthly',
      isEstimate: salary.period !== 'monthly',
    };
  }

  private generateContentHash(data: {
    title: string;
    companyName: string;
    location: string;
    url: string;
  }): string {
    const content = `${data.title}|${data.companyName}|${data.location}|${data.url}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

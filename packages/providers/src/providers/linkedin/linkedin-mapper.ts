import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import { decodeHtmlEntities, decodeTechnologies } from '../../shared/html-entities.js';

const TECH_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust',
  'react', 'vue', 'angular', 'node', 'express', 'django', 'flask', 'spring',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible',
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  'git', 'ci/cd', 'jenkins', 'github actions', 'gitlab',
  'html', 'css', 'scss', 'tailwind',
  'sql', 'nosql', 'graphql', 'rest', 'grpc',
  'linux', 'bash',
  'machine learning', 'ml', 'ai', 'data science',
  'flutter', 'swift', 'kotlin', 'android', 'ios',
  'php', 'ruby', 'scala', 'dart',
  'nextjs', 'nuxtjs', 'svelte',
  'webpack', 'vite',
  'jest', 'mocha', 'pytest',
];

export class LinkedInMapper implements Mapper {
  readonly providerId = 'linkedin';

  map(raw: RawJob): MappedJob {
    const title = this.normalizeTitle(raw.title);
    const description = this.normalizeDescription(raw.description);
    const companyName = this.normalizeCompanyName(raw.companyName);
    const location = this.normalizeLocation(raw.location);
    const technologies = this.extractTechnologies(title, description, raw.technologies);

    return {
      sourceId: raw.sourceId,
      title,
      description,
      companyName,
      companySourceId: raw.companySourceId,
      location,
      salary: undefined,
      experienceLevel: raw.experienceLevel ?? this.inferExperienceLevel(title, description),
      technologies,
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote ?? this.inferRemote(raw.location),
      employmentType: raw.employmentType ?? this.inferEmploymentType(title, description),
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

  private normalizeCompanyName(companyName: string): string {
    return decodeHtmlEntities(companyName)
      .replace(/\s+/g, ' ')
      .replace(/-\s*LinkedIn$/, '')
      .trim();
  }

  private normalizeLocation(location: string): MappedJob['location'] {
    if (!location) {
      return { raw: '' };
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

  private extractTechnologies(
    title: string,
    description: string,
    existingTech: readonly string[],
  ): string[] {
    const combined = `${title} ${description}`.toLowerCase();
    const skills = decodeTechnologies(existingTech);

    for (const tech of TECH_KEYWORDS) {
      if (combined.includes(tech)) {
        skills.push(tech);
      }
    }

    return [...new Set(skills)];
  }

  private inferExperienceLevel(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    if (/\b(intern|internship)\b/i.test(combined)) return 'intern';
    if (/\b(junior|jr\.?)\b/i.test(combined)) return 'junior';
    if (/\b(mid-level|middle)\b/i.test(combined)) return 'middle';
    if (/\b(senior|sr\.?)\b/i.test(combined)) return 'senior';
    if (/\b(lead|team lead)\b/i.test(combined)) return 'lead';
    if (/\b(principal|staff)\b/i.test(combined)) return 'principal';

    return undefined;
  }

  private inferEmploymentType(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();

    if (/\b(full[\s-]?time)\b/i.test(combined)) return 'full_time';
    if (/\b(part[\s-]?time)\b/i.test(combined)) return 'part_time';
    if (/\b(contract|contractor)\b/i.test(combined)) return 'contract';
    if (/\b(freelance)\b/i.test(combined)) return 'freelance';
    if (/\b(intern|internship)\b/i.test(combined)) return 'internship';

    return undefined;
  }

  private inferRemote(location: string): boolean {
    const lower = location.toLowerCase();
    return lower.includes('remote') || lower.includes('anywhere');
  }
}

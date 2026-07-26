import type { AtsJob } from '../adapters/base-adapter.js';
import type { CompanyWatchData } from '../domain/repositories/index.js';

export interface NormalizedJob {
  externalId: string;
  title: string;
  description: string;
  url: string;
  location?: string;
  salary?: { min?: number; max?: number; currency?: string };
  technologies: string[];
  publishedAt?: Date;
  departments?: string[];
  companyWatchId: string;
  contentHash: string;
}

export class NormalizationService {
  normalize(job: AtsJob, company: CompanyWatchData): NormalizedJob {
    return {
      externalId: job.externalId,
      title: this.normalizeTitle(job.title),
      description: this.normalizeDescription(job.description),
      url: job.url,
      location: this.normalizeLocation(job.location),
      salary: job.salary,
      technologies: this.normalizeTechnologies(job.technologies || []),
      publishedAt: job.publishedAt,
      departments: job.departments,
      companyWatchId: company.id,
      contentHash: this.generateContentHash(job),
    };
  }

  private normalizeTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeDescription(description: string): string {
    return description
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeLocation(location?: string): string | undefined {
    if (!location) return undefined;
    return location
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeTechnologies(technologies: string[]): string[] {
    const normalized = new Set<string>();
    for (const tech of technologies) {
      const normalizedTech = tech.toLowerCase().trim();
      if (normalizedTech) {
        normalized.add(normalizedTech);
      }
    }
    return Array.from(normalized);
  }

  private generateContentHash(job: AtsJob): string {
    const content = `${job.title}|${job.description}|${job.url}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

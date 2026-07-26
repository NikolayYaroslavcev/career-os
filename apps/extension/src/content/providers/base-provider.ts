import type { ContentVacancy, ApplyEvent } from '@careeros/extension-shared';

export interface ProviderDetector {
  readonly id: string;
  
  matches(url: string): boolean;
  
  extract(document: Document, url: string): ContentVacancy | null;
  
  detectApply(document: Document, url: string): ApplyEvent | null;
  
  getApplyButtonSelector(): string | null;
}

export abstract class BaseProviderDetector implements ProviderDetector {
  abstract readonly id: string;

  abstract matches(url: string): boolean;

  abstract extract(document: Document, url: string): ContentVacancy | null;

  detectApply(_document: Document, _url: string): ApplyEvent | null {
    return null;
  }

  getApplyButtonSelector(): string | null {
    return null;
  }

  protected createVacancy(partial: Omit<ContentVacancy, 'extractedAt' | 'contentHash'>): ContentVacancy {
    const contentHash = this.computeHash(partial.title, partial.company, partial.description);
    return {
      ...partial,
      extractedAt: new Date().toISOString(),
      contentHash,
    };
  }

  protected computeHash(title: string, company: string, description: string): string {
    const data = `${title}|${company}|${description.slice(0, 500)}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  protected queryText(doc: Document, selector: string): string | null {
    return doc.querySelector(selector)?.textContent?.trim() ?? null;
  }

  protected queryAllText(doc: Document, selector: string): string[] {
    return Array.from(doc.querySelectorAll(selector))
      .map(el => el.textContent?.trim() ?? '')
      .filter(Boolean);
  }

  protected extractTechnologies(text: string): string[] {
    const keywords = [
      'javascript', 'typescript', 'python', 'java', 'go', 'golang', 'rust', 'c\\+\\+',
      'react', 'vue', 'angular', 'svelte', 'next\\.?js', 'nuxt', 'node\\.?js', 'express',
      'django', 'flask', 'fastapi', 'spring', 'rails', 'laravel',
      'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform',
      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      'graphql', 'rest', 'grpc',
      'html', 'css', 'sass', 'tailwind',
      'git', 'ci/cd', 'jenkins', 'github actions',
    ];

    const technologies: string[] = [];
    const lowerText = text.toLowerCase();

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowerText)) {
        technologies.push(keyword.replace(/\\\+/g, '+').replace(/\\\./g, '.'));
      }
    }

    return [...new Set(technologies)];
  }

  protected extractRequirements(text: string): string[] {
    const lines = text.split('\n');
    const requirements: string[] = [];
    let inRequirements = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (/^(requirements|qualifications|must have|required|what you.?ll need)/i.test(trimmed)) {
        inRequirements = true;
        continue;
      }

      if (inRequirements && /^(about|benefits|what we offer|nice to have|responsibilities)/i.test(trimmed)) {
        inRequirements = false;
        continue;
      }

      if (inRequirements && (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('\u2022') || /^\d+\./.test(trimmed))) {
        requirements.push(trimmed.replace(/^[-*\u2022]\s*/, '').replace(/^\d+\.\s*/, ''));
      }
    }

    return requirements;
  }
}

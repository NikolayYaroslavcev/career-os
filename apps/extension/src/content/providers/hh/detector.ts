import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy, ApplyEvent } from '@careeros/extension-shared';

export class HHDetector extends BaseProviderDetector {
  readonly id = 'hh';

  matches(url: string): boolean {
    return /hh\.(ru|kz|ua)\/vacancy\//.test(url);
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const title = this.queryText(document, '[data-qa="vacancy-title"]')
      ?? this.queryText(document, 'h1');
    const company = document.querySelector('[data-qa="vacancy-employer-logo"]')?.closest('a')?.textContent?.trim()
      ?? this.queryText(document, '[data-qa="vacancy-employer"]');
    const location = this.queryText(document, '[data-qa="vacancy-view-location"]');
    const description = this.queryText(document, '[data-qa="vacancy-description"]')
      ?? this.queryText(document, '.vacancy-description');
    const salaryText = this.queryText(document, '[data-qa="vacancy-compensation"]');

    const externalId = url.match(/\/vacancy\/(\d+)/)?.[1] ?? '';

    if (!title || !company) return null;

    return this.createVacancy({
      provider: 'hh',
      externalId,
      title,
      company,
      location: location ?? '',
      salary: salaryText ? this.parseHHSalary(salaryText) : undefined,
      experienceLevel: this.mapExperience(
        this.queryText(document, '[data-qa="vacancy-serp__vacancy-experience"]')
      ),
      employmentType: this.mapEmployment(
        this.queryText(document, '[data-qa="vacancy-serp__vacancy-employment"]')
      ),
      remote: this.mapRemote(
        this.queryText(document, '[data-qa="vacancy-serp__vacancy-work-schedule"]')
      ),
      technologies: this.extractTechnologies(description ?? ''),
      description: description ?? '',
      requirements: this.extractRequirements(description ?? ''),
      url: url.split('?')[0] ?? url,
      publishedAt: this.queryText(document, '[data-qa="vacancy-serp__vacancy-date"]') ?? undefined,
    });
  }

  detectApply(document: Document, url: string): ApplyEvent | null {
    const applyButton = document.querySelector('[data-qa="vacancy-response-link"]');
    if (applyButton) {
      return { provider: 'hh', url, timestamp: new Date().toISOString(), method: 'click' };
    }
    return null;
  }

  getApplyButtonSelector(): string {
    return '[data-qa="vacancy-response-link"]';
  }

  private parseHHSalary(text: string): ContentVacancy['salary'] {
    const cleaned = text.replace(/[^\d.,\-\u20BD\u20B8]/g, ' ').trim();
    const numbers = cleaned.match(/[\d,.]+/g)?.map(n => parseFloat(n.replace(/,/g, ''))) ?? [];
    if (numbers.length === 0) return undefined;
    const isKZT = text.includes('\u20B8');
    const isRUB = text.includes('\u20BD');
    return {
      min: numbers[0],
      max: numbers.length > 1 ? numbers[1] : undefined,
      currency: isKZT ? 'KZT' : isRUB ? 'RUB' : 'RUB',
      period: 'monthly',
    };
  }

  private mapExperience(text: string | null): ContentVacancy['experienceLevel'] {
    if (!text) return undefined;
    const lower = text.toLowerCase();
    if (lower.includes('нет опыта') || lower.includes('intern')) return 'intern';
    if (lower.includes('1\u20133') || lower.includes('junior')) return 'junior';
    if (lower.includes('3\u20136') || lower.includes('middle')) return 'middle';
    if (lower.includes('6+') || lower.includes('senior')) return 'senior';
    return undefined;
  }

  private mapEmployment(text: string | null): ContentVacancy['employmentType'] {
    if (!text) return undefined;
    const lower = text.toLowerCase();
    if (lower.includes('полная')) return 'full_time';
    if (lower.includes('частичная') || lower.includes('\u0447\u0430\u0441\u0442\u0438\u0447\u043d\u0430\u044f')) return 'part_time';
    if (lower.includes('проект') || lower.includes('contract')) return 'contract';
    return undefined;
  }

  private mapRemote(text: string | null): ContentVacancy['remote'] {
    if (!text) return undefined;
    const lower = text.toLowerCase();
    if (lower.includes('удалённо') || lower.includes('удаленно') || lower.includes('remote')) return 'remote_only';
    if (lower.includes('гибрид') || lower.includes('hybrid')) return 'hybrid';
    if (lower.includes('офис') || lower.includes('office')) return 'onsite';
    return undefined;
  }
}

const detector = new HHDetector();
if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({ type: 'EXTRACT_VACANCY_COMPLETE', payload: vacancy });
  }
  const applyEvent = detector.detectApply(document, window.location.href);
  if (applyEvent) {
    chrome.runtime.sendMessage({ type: 'APPLY_DETECTED', payload: applyEvent });
  }
}

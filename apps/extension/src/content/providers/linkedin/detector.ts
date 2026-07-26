import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy, ApplyEvent } from '@careeros/extension-shared';

export class LinkedInDetector extends BaseProviderDetector {
  readonly id = 'linkedin';

  matches(url: string): boolean {
    return /linkedin\.com\/jobs\/(view\/)?/.test(url);
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const title = this.queryText(document, '.top-card-layout__title')
      ?? this.queryText(document, 'h1');
    const company = this.queryText(document, '.top-card-layout__second-subline a')
      ?? this.queryText(document, '.top-card-entity-list-item__entity-name');
    const location = this.queryText(document, '.top-card-layout__second-subline');
    const description = this.queryText(document, '.description__text')
      ?? this.queryText(document, '.show-more-less-html__markup');

    const salaryText = this.queryText(document, '.salary-text');
    const skills = this.queryAllText(document, '.skills-section__skill-text');
    const expLevel = this.queryText(document, '.experience-level');
    const remoteText = this.queryText(document, '.workplace-type');

    const externalId = url.match(/\/jobs\/view\/(\d+)/)?.[1]
      ?? url.match(/currentJobId=(\d+)/)?.[1]
      ?? '';

    if (!title || !company) return null;

    return this.createVacancy({
      provider: 'linkedin',
      externalId,
      title,
      company,
      location: location ?? '',
      salary: salaryText ? this.parseSalary(salaryText) : undefined,
      experienceLevel: this.mapExperience(expLevel),
      employmentType: undefined,
      remote: this.mapRemote(remoteText),
      technologies: skills.length > 0 ? skills : this.extractTechnologies(description ?? ''),
      description: description ?? '',
      requirements: this.extractRequirements(description ?? ''),
      url: url.split('?')[0] ?? url,
    });
  }

  detectApply(document: Document, url: string): ApplyEvent | null {
    const applyButton = document.querySelector('.jobs-apply-button')
      ?? document.querySelector('[data-control-name="apply_button"]');

    if (applyButton) {
      return {
        provider: 'linkedin',
        url,
        timestamp: new Date().toISOString(),
        method: 'click',
      };
    }

    return null;
  }

  getApplyButtonSelector(): string {
    return '.jobs-apply-button, [data-control-name="apply_button"]';
  }

  private parseSalary(text: string): ContentVacancy['salary'] {
    const cleaned = text.replace(/[^\d.,-]/g, ' ').trim();
    const numbers = cleaned.match(/[\d,.]+/g)?.map(n => parseFloat(n.replace(/,/g, ''))) ?? [];
    
    if (numbers.length === 0) return undefined;

    return {
      min: numbers[0],
      max: numbers.length > 1 ? numbers[1] : undefined,
      currency: text.includes('$') ? 'USD' : text.includes('\u20BD') ? 'RUB' : text.includes('\u20AC') ? 'EUR' : 'USD',
      period: 'yearly',
    };
  }

  private mapExperience(text: string | null): ContentVacancy['experienceLevel'] {
    if (!text) return undefined;
    const lower = text.toLowerCase();
    if (lower.includes('intern')) return 'intern';
    if (lower.includes('junior') || lower.includes('entry')) return 'junior';
    if (lower.includes('mid') || lower.includes('associate')) return 'middle';
    if (lower.includes('senior') || lower.includes('lead')) return 'senior';
    if (lower.includes('principal') || lower.includes('staff')) return 'principal';
    return undefined;
  }

  private mapRemote(text: string | null): ContentVacancy['remote'] {
    if (!text) return undefined;
    const lower = text.toLowerCase();
    if (lower.includes('remote')) return 'remote_only';
    if (lower.includes('hybrid') || lower.includes('on-site')) return 'hybrid';
    if (lower.includes('on-site') || lower.includes('onsite')) return 'onsite';
    return undefined;
  }
}

const detector = new LinkedInDetector();

if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({
      type: 'EXTRACT_VACANCY_COMPLETE',
      payload: vacancy,
    });
  }

  const applyEvent = detector.detectApply(document, window.location.href);
  if (applyEvent) {
    chrome.runtime.sendMessage({
      type: 'APPLY_DETECTED',
      payload: applyEvent,
    });
  }
}

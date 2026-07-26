import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy, ApplyEvent } from '@careeros/extension-shared';

export class LeverDetector extends BaseProviderDetector {
  readonly id = 'lever';

  matches(url: string): boolean {
    return /jobs\.lever\.co\/[^/]+/.test(url);
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const title = this.queryText(document, '.posting-headline h2')
      ?? this.queryText(document, 'h1');
    const company = this.queryText(document, '.posting-headline .company')
      ?? this.queryText(document, '.company-name');
    const location = this.queryText(document, '.posting-headline .location')
      ?? this.queryText(document, '.location');
    const description = this.queryText(document, '.posting-page .content')
      ?? this.queryText(document, '.section-wrapper');

    const externalId = url.match(/lever\.co\/([^/]+)/)?.[1] ?? '';

    if (!title) return null;

    return this.createVacancy({
      provider: 'lever',
      externalId,
      title,
      company: company ?? '',
      location: location ?? '',
      technologies: this.extractTechnologies(description ?? ''),
      description: description ?? '',
      requirements: this.extractRequirements(description ?? ''),
      url,
    });
  }

  detectApply(document: Document, url: string): ApplyEvent | null {
    const applyButton = document.querySelector('.postings-apply button');
    if (applyButton) {
      return { provider: 'lever', url, timestamp: new Date().toISOString(), method: 'click' };
    }
    return null;
  }

  getApplyButtonSelector(): string {
    return '.postings-apply button';
  }
}

const detector = new LeverDetector();
if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({ type: 'EXTRACT_VACANCY_COMPLETE', payload: vacancy });
  }
}

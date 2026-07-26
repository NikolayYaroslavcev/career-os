import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy, ApplyEvent } from '@careeros/extension-shared';

export class AshbyDetector extends BaseProviderDetector {
  readonly id = 'ashby';

  matches(url: string): boolean {
    return /jobs\.ashbyhq\.com\/[^/]+/.test(url);
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const title = this.queryText(document, 'h1');
    const company = this.queryText(document, '[class*="company"]')
      ?? this.queryText(document, '.posting-headline .company-name');
    const location = this.queryText(document, '[class*="location"]')
      ?? this.queryText(document, '.posting-headline .location');
    const description = this.queryText(document, '.ashby-job-posting')
      ?? this.queryText(document, '.content');

    const externalId = url.match(/ashbyhq\.com\/([^/]+)/)?.[1] ?? '';

    if (!title) return null;

    return this.createVacancy({
      provider: 'ashby',
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
    const applyButton = document.querySelector('.ashby-application-form button[type="submit"]');
    if (applyButton) {
      return { provider: 'ashby', url, timestamp: new Date().toISOString(), method: 'click' };
    }
    return null;
  }

  getApplyButtonSelector(): string {
    return '.ashby-application-form button[type="submit"]';
  }
}

const detector = new AshbyDetector();
if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({ type: 'EXTRACT_VACANCY_COMPLETE', payload: vacancy });
  }
}

import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy, ApplyEvent } from '@careeros/extension-shared';

export class GreenhouseDetector extends BaseProviderDetector {
  readonly id = 'greenhouse';

  matches(url: string): boolean {
    return /boards\.greenhouse\.io\/[^/]+\/jobs\/\d+/.test(url)
      || /boards\.greenhouse\.io\/[^/]+$/.test(url);
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const title = this.queryText(document, '#header .app-title')
      ?? this.queryText(document, 'h1');
    const company = this.queryText(document, '#header .company-name');
    const location = this.queryText(document, '#header .location');
    const description = this.queryText(document, '#content')
      ?? this.queryText(document, '.content');

    const externalId = url.match(/\/jobs\/(\d+)/)?.[1] ?? '';

    if (!title) return null;

    return this.createVacancy({
      provider: 'greenhouse',
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
    const applyButton = document.querySelector('.apply-form button[type="submit"]');
    if (applyButton) {
      return { provider: 'greenhouse', url, timestamp: new Date().toISOString(), method: 'click' };
    }
    return null;
  }

  getApplyButtonSelector(): string {
    return '.apply-form button[type="submit"]';
  }
}

const detector = new GreenhouseDetector();
if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({ type: 'EXTRACT_VACANCY_COMPLETE', payload: vacancy });
  }
}

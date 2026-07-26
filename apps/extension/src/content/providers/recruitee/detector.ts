import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy } from '@careeros/extension-shared';

export class RecruiteeDetector extends BaseProviderDetector {
  readonly id = 'recruitee';

  matches(url: string): boolean {
    return /recruitee\.com\/o\/[^/]+/.test(url);
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const title = this.queryText(document, 'h1')
      ?? this.queryText(document, '.job-details__title');
    const company = this.queryText(document, '.job-details__company')
      ?? this.queryText(document, '[class*="company"]');
    const location = this.queryText(document, '.job-details__location')
      ?? this.queryText(document, '[class*="location"]');
    const description = this.queryText(document, '.job-details__description')
      ?? this.queryText(document, '.job-description')
      ?? this.queryText(document, 'article');

    const externalId = url.match(/o\/([^?/]+)/)?.[1] ?? '';

    if (!title) return null;

    return this.createVacancy({
      provider: 'recruitee',
      externalId,
      title,
      company: company ?? '',
      location: location ?? '',
      technologies: this.extractTechnologies(description ?? ''),
      description: description ?? '',
      requirements: this.extractRequirements(description ?? ''),
      url: url.split('?')[0] ?? url,
    });
  }
}

const detector = new RecruiteeDetector();
if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({ type: 'EXTRACT_VACANCY_COMPLETE', payload: vacancy });
  }
}

import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy } from '@careeros/extension-shared';

export class SmartRecruitersDetector extends BaseProviderDetector {
  readonly id = 'smartrecruiters';

  matches(url: string): boolean {
    return /careers\.smartrecruiters\.com\/[^/]+\/job\//.test(url);
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const title = this.queryText(document, 'h1')
      ?? this.queryText(document, '.job-title');
    const company = this.queryText(document, '.company-name')
      ?? this.queryText(document, '[class*="company"]');
    const location = this.queryText(document, '.job-location')
      ?? this.queryText(document, '[class*="location"]');
    const description = this.queryText(document, '.job-sections')
      ?? this.queryText(document, '.job-description')
      ?? this.queryText(document, 'article');

    const externalId = url.match(/job\/([^?/]+)/)?.[1] ?? '';

    if (!title) return null;

    return this.createVacancy({
      provider: 'smartrecruiters',
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

const detector = new SmartRecruitersDetector();
if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({ type: 'EXTRACT_VACANCY_COMPLETE', payload: vacancy });
  }
}

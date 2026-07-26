import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy } from '@careeros/extension-shared';

export class WorkdayDetector extends BaseProviderDetector {
  readonly id = 'workday';

  matches(url: string): boolean {
    return /myworkdayjobs\.com\/[^/]+\/job\//.test(url);
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const title = this.queryText(document, '[data-automation-id="jobTitle"]')
      ?? this.queryText(document, 'h1');
    const company = this.queryText(document, '[data-automation-id="companyName"]');
    const location = this.queryText(document, '[data-automation-id="location"]')
      ?? this.queryText(document, '[data-automation-id="subheader"]');
    const description = this.queryText(document, '[data-automation-id="jobDescription"]')
      ?? this.queryText(document, '.job-description');

    const externalId = url.match(/job\/([^?]+)/)?.[1] ?? '';

    if (!title) return null;

    return this.createVacancy({
      provider: 'workday',
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

const detector = new WorkdayDetector();
if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({ type: 'EXTRACT_VACANCY_COMPLETE', payload: vacancy });
  }
}

import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy } from '@careeros/extension-shared';
import { findJobPostingJsonLd } from '../../../shared/utils/dom-utils.js';

export class TeamtailorDetector extends BaseProviderDetector {
  readonly id = 'teamtailor';

  matches(url: string): boolean {
    return /teamtailor\.com\/[^/]+\/jobs/.test(url);
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const jsonLd = findJobPostingJsonLd(document);
    if (jsonLd) {
      return this.createVacancy({
        provider: 'teamtailor',
        externalId: (jsonLd.identifier as string) ?? url,
        title: (jsonLd.title as string) ?? '',
        company: ((jsonLd.hiringOrganization as Record<string, unknown>)?.name as string) ?? '',
        location: typeof jsonLd.jobLocation === 'object'
          ? `${((jsonLd.jobLocation as Record<string, unknown>)?.address as Record<string, unknown> | undefined)?.addressLocality ?? ''}`
          : (jsonLd.jobLocation as string) ?? '',
        technologies: this.extractTechnologies((jsonLd.description as string) ?? ''),
        description: (jsonLd.description as string) ?? '',
        requirements: this.extractRequirements((jsonLd.description as string) ?? ''),
        url: (jsonLd.url as string) ?? url,
        publishedAt: (jsonLd.datePosted as string) ?? undefined,
      });
    }

    const title = this.queryText(document, 'h1');
    const company = this.queryText(document, '[class*="company"]')
      ?? this.queryText(document, '.job-header__company');
    const location = this.queryText(document, '[class*="location"]')
      ?? this.queryText(document, '.job-header__location');
    const description = this.queryText(document, '.job-content')
      ?? this.queryText(document, 'article');

    if (!title) return null;

    return this.createVacancy({
      provider: 'teamtailor',
      externalId: url,
      title,
      company: company ?? '',
      location: location ?? '',
      technologies: this.extractTechnologies(description ?? ''),
      description: description ?? '',
      requirements: this.extractRequirements(description ?? ''),
      url,
    });
  }
}

const detector = new TeamtailorDetector();
if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({ type: 'EXTRACT_VACANCY_COMPLETE', payload: vacancy });
  }
}

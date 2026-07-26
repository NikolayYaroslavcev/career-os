import { BaseProviderDetector } from '../base-provider.js';
import type { ContentVacancy } from '@careeros/extension-shared';
import { findJobPostingJsonLd } from '../../../shared/utils/dom-utils.js';

export class GenericJsonLdDetector extends BaseProviderDetector {
  readonly id = 'generic';

  matches(_url: string): boolean {
    return true;
  }

  extract(document: Document, url: string): ContentVacancy | null {
    const jsonLd = findJobPostingJsonLd(document);
    if (!jsonLd) return null;

    const title = (jsonLd.title as string) ?? '';
    const company = ((jsonLd.hiringOrganization as Record<string, unknown>)?.name as string) ?? '';
    const description = (jsonLd.description as string) ?? '';

    if (!title || !company) return null;

    const locationData = jsonLd.jobLocation;
    let location = '';
    if (typeof locationData === 'object' && locationData !== null) {
      const addr = (locationData as Record<string, unknown>).address as Record<string, unknown> | undefined;
      if (addr) {
        location = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
          .filter(Boolean)
          .join(', ');
      }
    } else if (typeof locationData === 'string') {
      location = locationData;
    }

    const salaryData = jsonLd.estimatedSalary as Record<string, unknown> | undefined;
    const salary = salaryData ? {
      min: salaryData.minValue as number | undefined,
      max: salaryData.maxValue as number | undefined,
      currency: (salaryData.currency as string) ?? 'USD',
      period: (salaryData.unitText === 'HOUR' ? 'hourly' : 'yearly') as 'hourly' | 'yearly',
    } : undefined;

    const employmentTypeMap: Record<string, ContentVacancy['employmentType']> = {
      'FULL_TIME': 'full_time',
      'PART_TIME': 'part_time',
      'CONTRACTOR': 'contract',
      'TEMPORARY': 'contract',
      'INTERN': 'internship',
      'VOLUNTEER': 'freelance',
      'PER_DIEM': 'part_time',
      'OTHER': undefined,
    };

    const externalId = jsonLd.identifier
      ? (typeof jsonLd.identifier === 'object' ? (jsonLd.identifier as Record<string, unknown>).value as string : String(jsonLd.identifier))
      : url;

    return this.createVacancy({
      provider: 'generic',
      externalId: externalId ?? url,
      title,
      company,
      location,
      salary,
      employmentType: employmentTypeMap[(jsonLd.employmentType as string)] ?? undefined,
      remote: 'unknown',
      technologies: this.extractTechnologies(description),
      description,
      requirements: this.extractRequirements(description),
      url: (jsonLd.url as string) ?? url,
      publishedAt: (jsonLd.datePosted as string) ?? undefined,
    });
  }
}

const detector = new GenericJsonLdDetector();
if (detector.matches(window.location.href)) {
  const vacancy = detector.extract(document, window.location.href);
  if (vacancy) {
    chrome.runtime.sendMessage({ type: 'EXTRACT_VACANCY_COMPLETE', payload: vacancy });
  }
}

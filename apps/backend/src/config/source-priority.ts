import type { VacancySource } from '@careeros/career';
import type { ProviderType } from '@careeros/career';

/**
 * Source priority configuration for intelligent field merging.
 * Higher priority sources provide more authoritative data.
 */
export const SOURCE_PRIORITY: Record<VacancySource, number> = {
  greenhouse: 100,
  lever: 95,
  ashby: 95,
  workday: 90,
  smartrecruiters: 90,
  recruitee: 90,
  comeet: 90,
  teamtailor: 85,
  remote_ok: 80,
  remotive: 80,
  hh: 75,
  superjob: 75,
  habr_career: 75,
  linkedin: 70,
  wellfound: 70,
  otta: 70,
  himalayas: 65,
  arbeitnow: 65,
  jobicy: 65,
  we_work_remotely: 65,
  working_nomads: 60,
  nodesk: 60,
  hn_hiring: 55,
  rss_feed: 50,
  company_career_page: 45,
  telegram: 40,
  manual: 10,
};

export const PROVIDER_TYPE_PRIORITY: Record<ProviderType, number> = {
  ATS: 100,
  JOB_BOARD: 70,
  COMMUNITY: 40,
  MANUAL: 10,
};

/**
 * Get the priority for a given source.
 * Higher number = more authoritative.
 */
export function getSourcePriority(source: VacancySource): number {
  return SOURCE_PRIORITY[source] ?? 50;
}

/**
 * Get the priority for a provider type.
 */
export function getProviderTypePriority(type: ProviderType): number {
  return PROVIDER_TYPE_PRIORITY[type] ?? 50;
}

/**
 * Determine which source wins when merging fields.
 * Returns true if `winner` should override `current`.
 */
export function shouldOverride(
  currentSource: VacancySource,
  newSource: VacancySource,
): boolean {
  return getSourcePriority(newSource) > getSourcePriority(currentSource);
}

/**
 * Map a VacancySource to its ProviderType.
 */
export function inferProviderType(source: VacancySource): ProviderType {
  const atsProviders = ['greenhouse', 'lever', 'ashby', 'workday', 'smartrecruiters', 'recruitee', 'comeet', 'teamtailor'];
  const jobBoardProviders = ['remote_ok', 'remotive', 'hh', 'superjob', 'habr_career', 'linkedin', 'wellfound', 'otta', 'himalayas', 'arbeitnow', 'jobicy', 'we_work_remotely', 'working_nomads', 'nodesk'];
  const communityProviders = ['hn_hiring', 'rss_feed', 'company_career_page', 'telegram'];

  if (atsProviders.includes(source)) return 'ATS';
  if (jobBoardProviders.includes(source)) return 'JOB_BOARD';
  if (communityProviders.includes(source)) return 'COMMUNITY';
  return 'MANUAL';
}

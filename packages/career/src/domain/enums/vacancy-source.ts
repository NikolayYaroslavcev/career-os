export const VacancySource = {
  LINKEDIN: 'linkedin',
  HH: 'hh',
  HABR_CAREER: 'habr_career',
  // WELLFOUND: rejected, do not implement — no API, ToS-risky scraping,
  // inconsistent direct-apply flow. See research/free-provider-expansion/REPORT.md §4.5.
  WELLFOUND: 'wellfound',
  // OTTA: retired, do not implement — Otta merged into Welcome to the Jungle
  // and no longer exists as an independent product; its pre-merger apply flow
  // was platform-mediated (not direct-apply) anyway. Slot kept reserved-but-
  // dormant rather than deleted (avoids a breaking enum/type change) per
  // research/free-provider-expansion/EPIC.md Phase 0 §3 / REPORT.md §4.5.
  OTTA: 'otta',
  RSS_FEED: 'rss_feed',
  COMPANY_CAREER_PAGE: 'company_career_page',
  TELEGRAM: 'telegram',
  // Distinct from LINKEDIN ('linkedin', the LinkedIn Jobs guest-API scraper)
  // — this is the browser-extension push path from the user's own
  // authenticated LinkedIn Feed (SocialPlatform.LINKEDIN), AI-extracted the
  // same way Telegram community posts are, not a structured job-board API.
  LINKEDIN_FEED: 'linkedin_feed',
  MANUAL: 'manual',
  GREENHOUSE: 'greenhouse',
  LEVER: 'lever',
  ASHBY: 'ashby',
  WORKDAY: 'workday',
  TEAMTAILOR: 'teamtailor',
  REMOTIVE: 'remotive',
  ARBEITNOW: 'arbeitnow',
  JOBICY: 'jobicy',
  WE_WORK_REMOTELY: 'we_work_remotely',
  WORKING_NOMADS: 'working_nomads',
  NODESK: 'nodesk',
  HN_HIRING: 'hn_hiring',
  SMARTRECRUITERS: 'smartrecruiters',
  RECRUITEE: 'recruitee',
  SUPERJOB: 'superjob',
  COMEET: 'comeet',
  PERSONIO: 'personio',
  WORKABLE: 'workable',
  PYJOBS: 'pyjobs',
  DJANGO_JOBS: 'django_jobs',
  SPEEDRUN: 'speedrun',
  FRANCE_TRAVAIL: 'france_travail',
  ADZUNA: 'adzuna',
  JUSTJOIN_IT: 'justjoin_it',
} as const;

export type VacancySource = (typeof VacancySource)[keyof typeof VacancySource];

export const SourcePriority = {
  ATS: 1,
  JOB_BOARD: 2,
  COMMUNITY: 3,
  MANUAL: 4,
} as const;

export type SourcePriorityLevel = (typeof SourcePriority)[keyof typeof SourcePriority];

export const PROVIDER_PRIORITY: Record<string, number> = {
  greenhouse: 1,
  lever: 1,
  ashby: 1,
  workday: 1,
  smartrecruiters: 1,
  recruitee: 1,
  teamtailor: 1,
  comeet: 1,
  remote_ok: 2,
  remotive: 2,
  hh: 2,
  habr_career: 2,
  linkedin: 2,
  wellfound: 2,
  otta: 2,
  himalayas: 2,
  arbeitnow: 2,
  jobicy: 2,
  we_work_remotely: 2,
  working_nomads: 2,
  nodesk: 2,
  hn_hiring: 3,
  rss_feed: 3,
  company_career_page: 3,
  telegram: 3,
  manual: 4,
};

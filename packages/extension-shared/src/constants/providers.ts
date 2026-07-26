export const PROVIDER_IDS = {
  LINKEDIN: 'linkedin',
  HH: 'hh',
  GREENHOUSE: 'greenhouse',
  LEVER: 'lever',
  ASHBY: 'ashby',
  WORKDAY: 'workday',
  TEAMTAILOR: 'teamtailor',
  SMARTRECRUITERS: 'smartrecruiters',
  RECRUITEE: 'recruitee',
  GENERIC: 'generic',
} as const;

export type ProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

export interface ProviderUrlPattern {
  provider: ProviderId;
  patterns: RegExp[];
  description: string;
}

export const PROVIDER_URL_PATTERNS: ProviderUrlPattern[] = [
  {
    provider: PROVIDER_IDS.LINKEDIN,
    patterns: [
      /linkedin\.com\/jobs\/(view\/)?/,
      /linkedin\.com\/jobs\/search/,
    ],
    description: 'LinkedIn job postings',
  },
  {
    provider: PROVIDER_IDS.HH,
    patterns: [
      /hh\.(ru|kz)\/vacancy\//,
      /hh\.ua\/vacancy\//,
    ],
    description: 'HeadHunter vacancies',
  },
  {
    provider: PROVIDER_IDS.GREENHOUSE,
    patterns: [
      /boards\.greenhouse\.io\/[^/]+\/jobs\/\d+/,
      /boards\.greenhouse\.io\/[^/]+$/,
    ],
    description: 'Greenhouse job boards',
  },
  {
    provider: PROVIDER_IDS.LEVER,
    patterns: [
      /jobs\.lever\.co\/[^/]+/,
    ],
    description: 'Lever job postings',
  },
  {
    provider: PROVIDER_IDS.ASHBY,
    patterns: [
      /jobs\.ashbyhq\.com\/[^/]+/,
    ],
    description: 'Ashby job postings',
  },
  {
    provider: PROVIDER_IDS.WORKDAY,
    patterns: [
      /myworkdayjobs\.com\/[^/]+\/job\//,
    ],
    description: 'Workday job postings',
  },
  {
    provider: PROVIDER_IDS.TEAMTAILOR,
    patterns: [
      /teamtailor\.com\/[^/]+\/jobs/,
    ],
    description: 'Teamtailor job postings',
  },
  {
    provider: PROVIDER_IDS.SMARTRECRUITERS,
    patterns: [
      /careers\.smartrecruiters\.com\/[^/]+\/job\//,
    ],
    description: 'SmartRecruiters job postings',
  },
  {
    provider: PROVIDER_IDS.RECRUITEE,
    patterns: [
      /recruitee\.com\/o\/[^/]+/,
    ],
    description: 'Recruitee job postings',
  },
];

export const ALL_PROVIDER_IDS = Object.values(PROVIDER_IDS);

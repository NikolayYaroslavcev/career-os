export const ProviderType = {
  ATS: 'ATS',
  JOB_BOARD: 'JOB_BOARD',
  COMMUNITY: 'COMMUNITY',
  MANUAL: 'MANUAL',
} as const;

export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  ATS: 'ATS',
  JOB_BOARD: 'Job Board',
  COMMUNITY: 'Community',
  MANUAL: 'Manual',
};

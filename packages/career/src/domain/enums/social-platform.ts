export const SocialPlatform = {
  TELEGRAM: 'TELEGRAM',
  LINKEDIN: 'LINKEDIN',
} as const;

export type SocialPlatform = (typeof SocialPlatform)[keyof typeof SocialPlatform];

export const SocialPlatform = {
  TELEGRAM: 'TELEGRAM',
} as const;

export type SocialPlatform = (typeof SocialPlatform)[keyof typeof SocialPlatform];

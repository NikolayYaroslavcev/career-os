export const FollowUpType = {
  FOLLOW_UP: 'follow_up',
  INTERVIEW: 'interview',
  REPLY_EXPECTED: 'reply_expected',
  CUSTOM: 'custom',
} as const;

export type FollowUpType = (typeof FollowUpType)[keyof typeof FollowUpType];

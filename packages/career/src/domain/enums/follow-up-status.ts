export const FollowUpStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  COMPLETED: 'completed',
  SNOOZED: 'snoozed',
  CANCELLED: 'cancelled',
} as const;

export type FollowUpStatus = (typeof FollowUpStatus)[keyof typeof FollowUpStatus];

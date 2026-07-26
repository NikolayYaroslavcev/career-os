export const NotificationType = {
  FOLLOW_UP_REQUIRED: 'follow_up_required',
  INTERVIEW_REMINDER: 'interview_reminder',
  APPLICATION_STATUS_CHANGED: 'application_status_changed',
  NEW_VACANCY_MATCH: 'new_vacancy_match',
  DEADLINE_APPROACHING: 'deadline_approaching',
  OFFER_RECEIVED: 'offer_received',
  SYSTEM: 'system',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NOTIFICATION_PRIORITY: Record<NotificationType, 'low' | 'medium' | 'high'> = {
  [NotificationType.FOLLOW_UP_REQUIRED]: 'medium',
  [NotificationType.INTERVIEW_REMINDER]: 'high',
  [NotificationType.APPLICATION_STATUS_CHANGED]: 'medium',
  [NotificationType.NEW_VACANCY_MATCH]: 'low',
  [NotificationType.DEADLINE_APPROACHING]: 'high',
  [NotificationType.OFFER_RECEIVED]: 'high',
  [NotificationType.SYSTEM]: 'low',
};

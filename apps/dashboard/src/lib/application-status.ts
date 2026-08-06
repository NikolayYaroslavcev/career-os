import type { ApplicationStatus } from '@/api/applications';

export type StatusBadgeVariant = 'default' | 'secondary' | 'success' | 'destructive' | 'warning';

export const APPLICATION_STATUS_VARIANT: Record<ApplicationStatus, StatusBadgeVariant> = {
  saved: 'secondary',
  started: 'default',
  submitted: 'default',
  waiting: 'warning',
  hr_interview: 'warning',
  technical_interview: 'warning',
  final_interview: 'warning',
  offer: 'success',
  rejected: 'destructive',
  archived: 'secondary',
};

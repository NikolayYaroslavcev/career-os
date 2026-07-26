export const ApplicationStatus = {
  SAVED: 'saved',
  STARTED: 'started',
  SUBMITTED: 'submitted',
  WAITING: 'waiting',
  HR_INTERVIEW: 'hr_interview',
  TECHNICAL_INTERVIEW: 'technical_interview',
  FINAL_INTERVIEW: 'final_interview',
  OFFER: 'offer',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
} as const;

export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  started: 'Started',
  submitted: 'Submitted',
  waiting: 'Waiting',
  hr_interview: 'HR Interview',
  technical_interview: 'Technical Interview',
  final_interview: 'Final Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  archived: 'Archived',
};

export const TERMINAL_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
  ApplicationStatus.ARCHIVED,
];

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

export const APPLICATION_STATUS_ORDER: Record<ApplicationStatus, number> = {
  [ApplicationStatus.SAVED]: 0,
  [ApplicationStatus.STARTED]: 1,
  [ApplicationStatus.SUBMITTED]: 2,
  [ApplicationStatus.WAITING]: 3,
  [ApplicationStatus.HR_INTERVIEW]: 4,
  [ApplicationStatus.TECHNICAL_INTERVIEW]: 5,
  [ApplicationStatus.FINAL_INTERVIEW]: 6,
  [ApplicationStatus.OFFER]: 7,
  [ApplicationStatus.REJECTED]: 8,
  [ApplicationStatus.ARCHIVED]: 9,
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.SAVED]: 'Saved',
  [ApplicationStatus.STARTED]: 'Started',
  [ApplicationStatus.SUBMITTED]: 'Submitted',
  [ApplicationStatus.WAITING]: 'Waiting',
  [ApplicationStatus.HR_INTERVIEW]: 'HR Interview',
  [ApplicationStatus.TECHNICAL_INTERVIEW]: 'Technical Interview',
  [ApplicationStatus.FINAL_INTERVIEW]: 'Final Interview',
  [ApplicationStatus.OFFER]: 'Offer',
  [ApplicationStatus.REJECTED]: 'Rejected',
  [ApplicationStatus.ARCHIVED]: 'Archived',
};

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return status === ApplicationStatus.REJECTED || status === ApplicationStatus.ARCHIVED;
}

export function canTransitionTo(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (isTerminalStatus(from)) {
    return false;
  }

  if (from === to) {
    return false;
  }

  const fromOrder = APPLICATION_STATUS_ORDER[from];
  const toOrder = APPLICATION_STATUS_ORDER[to];

  return toOrder > fromOrder || to === ApplicationStatus.REJECTED || to === ApplicationStatus.ARCHIVED;
}

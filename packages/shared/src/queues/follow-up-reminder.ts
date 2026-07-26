export const FOLLOW_UP_REMINDER_QUEUE_NAME = 'follow-up-reminder';
export const FOLLOW_UP_REMINDER_JOB_NAME = 'sweep-due-follow-ups';

/** How often apps/worker re-schedules the recurring sweep (EPIC-08 reminder worker). */
export const FOLLOW_UP_REMINDER_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

import type { ContentVacancy, ApplyEvent, VacancyStatus } from './content-vacancy.js';
import type { LinkedInFeedPostCandidate } from './linkedin-feed.js';

export type ContentToBackgroundMessage =
  | { type: 'SAVE_VACANCY'; payload: ContentVacancy }
  | { type: 'ANALYZE_VACANCY'; payload: ContentVacancy }
  | { type: 'TAILOR_RESUME'; payload: ContentVacancy }
  | { type: 'COVER_LETTER'; payload: ContentVacancy }
  | { type: 'INTERVIEW_PREP'; payload: ContentVacancy }
  | { type: 'APPLY_DETECTED'; payload: ApplyEvent }
  | { type: 'GET_VACANCY_STATUS'; payload: { url: string } }
  | { type: 'CHECK_AUTH'; payload: Record<string, never> }
  | { type: 'LINKEDIN_FEED_POST_DETECTED'; payload: LinkedInFeedPostCandidate };

export type PopupToBackgroundMessage =
  | { type: 'GET_RECENT_VACANCIES'; payload: { limit: number } }
  | { type: 'GET_SAVED_TODAY'; payload: Record<string, never> }
  | { type: 'GET_PENDING_APPLICATIONS'; payload: Record<string, never> }
  | { type: 'GET_UPCOMING_INTERVIEWS'; payload: Record<string, never> }
  | { type: 'GET_NOTIFICATIONS'; payload: { limit: number } }
  | { type: 'QUICK_SEARCH'; payload: { query: string } }
  | { type: 'LOGIN'; payload: { email: string; password: string } }
  | { type: 'LOGOUT'; payload: Record<string, never> }
  | { type: 'CHECK_AUTH'; payload: Record<string, never> }
  | { type: 'GET_SETTINGS'; payload: Record<string, never> }
  | { type: 'SAVE_SETTINGS'; payload: Record<string, unknown> };

export type BackgroundMessage = ContentToBackgroundMessage | PopupToBackgroundMessage;

export type BackgroundResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; queued?: boolean };

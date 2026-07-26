export interface QueueItem {
  id: string;
  type: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  status: 'pending' | 'processing' | 'failed';
}

export type QueueMessageType =
  | 'SAVE_VACANCY'
  | 'ANALYZE_VACANCY'
  | 'TAILOR_RESUME'
  | 'COVER_LETTER'
  | 'INTERVIEW_PREP'
  | 'APPLY_DETECTED';

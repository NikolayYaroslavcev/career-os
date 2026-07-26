export const InterviewType = {
  HR: 'hr',
  TECHNICAL: 'technical',
  SYSTEM_DESIGN: 'system_design',
  BEHAVIORAL: 'behavioral',
  CODING: 'coding',
  CULTURAL: 'cultural',
  FINAL: 'final',
} as const;

export type InterviewType = (typeof InterviewType)[keyof typeof InterviewType];

export const INTERVIEW_DURATION_MINUTES: Record<InterviewType, number> = {
  [InterviewType.HR]: 30,
  [InterviewType.TECHNICAL]: 60,
  [InterviewType.SYSTEM_DESIGN]: 60,
  [InterviewType.BEHAVIORAL]: 45,
  [InterviewType.CODING]: 90,
  [InterviewType.CULTURAL]: 30,
  [InterviewType.FINAL]: 60,
};

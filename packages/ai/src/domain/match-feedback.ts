export const MatchFeedbackAction = {
  APPLIED: 'Applied',
  SKIPPED: 'Skipped',
  INTERVIEW: 'Interview',
  REJECTED: 'Rejected',
  OFFER: 'Offer',
} as const;

export type MatchFeedbackAction = (typeof MatchFeedbackAction)[keyof typeof MatchFeedbackAction];

export interface MatchFeedback {
  readonly id: string;
  readonly matchResultId: string;
  readonly userId: string;
  readonly vacancyId: string;
  readonly resumeId: string;
  readonly action: MatchFeedbackAction;
  readonly predictedScore: number;
  readonly predictedRecommendation: string;
  readonly actualOutcome: string | null;
  readonly comment: string | null;
  readonly createdAt: Date;
}

export interface MatchFeedbackInput {
  readonly matchResultId: string;
  readonly userId: string;
  readonly vacancyId: string;
  readonly resumeId: string;
  readonly action: MatchFeedbackAction;
  readonly comment?: string;
}

export interface MatchFeedbackSummary {
  readonly totalFeedback: number;
  readonly byAction: Readonly<Record<MatchFeedbackAction, number>>;
  readonly avgPredictedScore: number;
  readonly accuracyRate: number;
  readonly falsePositiveRate: number;
  readonly falseNegativeRate: number;
}

export interface MatchFeedbackRepository {
  save(feedback: MatchFeedback): Promise<void>;
  findByMatchResultId(matchResultId: string): Promise<MatchFeedback | null>;
  findByUserId(userId: string): Promise<readonly MatchFeedback[]>;
  findByVacancyId(vacancyId: string): Promise<readonly MatchFeedback[]>;
  getSummary(userId: string): Promise<MatchFeedbackSummary>;
}

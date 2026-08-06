import type { VacancyRequirementsResult } from '../prompts/vacancy-requirements-extraction.js';
import type { AtsScoreResult } from '../ats/ats-scoring-engine.js';
import type { SkillMatrixResult } from '../tailoring/skill-matrix-engine.js';
import type { TailoringChange, TailoringRejectedChange, TailoringHallucinationCheck } from '../tailoring/tailoring-reviewer.js';

export type TailoringStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type TailoringStage =
  | 'QUEUED'
  | 'PARSING_RESUME'
  | 'PARSING_VACANCY'
  | 'BUILDING_EVIDENCE'
  | 'TAILORING_RESUME'
  | 'ATS_SCORING'
  | 'REVIEWER_VALIDATION'
  | 'SAVING_RESULTS'
  | 'COMPLETED'
  | 'FAILED';

export interface TailoringStageExecution {
  readonly stage: TailoringStage;
  readonly status: 'COMPLETED' | 'FAILED';
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly model?: string;
  readonly provider?: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
  readonly estimatedCostUsd?: number;
  readonly retryCount: number;
  readonly error?: string;
}

export interface TailoredContentBullet {
  readonly text: string;
  readonly sourceBulletIndex: number;
}

export interface TailoredContentExperience {
  readonly jobIndex: number;
  readonly company: string;
  readonly position: string;
  readonly bullets: readonly TailoredContentBullet[];
  readonly technologies: readonly string[];
  readonly relevanceScore: number;
}

export interface TailoredContent {
  readonly summary: string;
  readonly experience: readonly TailoredContentExperience[];
  readonly emphasizedSkills: readonly string[];
  readonly keywordOptimizations: readonly string[];
}

export interface TailoredResume {
  readonly id: string;
  readonly userId: string;
  readonly resumeId: string;
  readonly vacancyId: string;
  readonly applicationId?: string;

  readonly status: TailoringStatus;
  readonly currentStage: TailoringStage;
  readonly stageExecutions: readonly TailoringStageExecution[];
  readonly inputHash: string;

  readonly vacancyRequirements?: VacancyRequirementsResult;
  readonly skillMatrix?: SkillMatrixResult;
  readonly tailoredContent?: TailoredContent;
  readonly tailoredResumeText?: string;
  readonly atsScoreBefore?: AtsScoreResult;
  readonly atsScoreAfter?: AtsScoreResult;
  readonly changesApplied: readonly TailoringChange[];
  readonly changesRejected: readonly TailoringRejectedChange[];
  readonly hallucinationCheck?: TailoringHallucinationCheck;
  readonly confidence?: number;
  readonly recruiterNotes?: string;

  readonly tailoringAlgorithmVersion?: string;
  readonly atsWeightsVersion?: string;
  readonly promptVersions: Readonly<Record<string, string>>;

  readonly error?: string;
  readonly retryCount: number;
  readonly createdAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly updatedAt: Date;
}

export function createQueuedTailoredResume(params: {
  id: string;
  userId: string;
  resumeId: string;
  vacancyId: string;
  applicationId?: string;
  inputHash: string;
}): TailoredResume {
  const now = new Date();
  return {
    id: params.id,
    userId: params.userId,
    resumeId: params.resumeId,
    vacancyId: params.vacancyId,
    applicationId: params.applicationId,
    status: 'QUEUED',
    currentStage: 'QUEUED',
    stageExecutions: [],
    inputHash: params.inputHash,
    changesApplied: [],
    changesRejected: [],
    promptVersions: {},
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

import type { TailoredResume, TailoringStatus, TailoringStage } from '@careeros/ai';

interface PrismaTailoredResume {
  id: string;
  status: string;
  currentStage: string;
  stageExecutions: unknown;
  inputHash: string;
  vacancyRequirements: unknown;
  skillMatrix: unknown;
  tailoredContent: unknown;
  tailoredResumeText: string | null;
  atsScoreBefore: unknown;
  atsScoreAfter: unknown;
  changesApplied: unknown;
  changesRejected: unknown;
  hallucinationCheck: unknown;
  confidence: number | null;
  recruiterNotes: string | null;
  tailoringAlgorithmVersion: string | null;
  atsWeightsVersion: string | null;
  promptVersions: unknown;
  error: string | null;
  retryCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  userId: string;
  resumeId: string;
  vacancyId: string;
  applicationId: string | null;
}

export class TailoredResumeMapper {
  static toDomain(record: PrismaTailoredResume): TailoredResume {
    return {
      id: record.id,
      userId: record.userId,
      resumeId: record.resumeId,
      vacancyId: record.vacancyId,
      applicationId: record.applicationId ?? undefined,
      status: record.status as TailoringStatus,
      currentStage: record.currentStage as TailoringStage,
      stageExecutions: (record.stageExecutions as TailoredResume['stageExecutions']) ?? [],
      inputHash: record.inputHash,
      vacancyRequirements: (record.vacancyRequirements as TailoredResume['vacancyRequirements']) ?? undefined,
      skillMatrix: (record.skillMatrix as TailoredResume['skillMatrix']) ?? undefined,
      tailoredContent: (record.tailoredContent as TailoredResume['tailoredContent']) ?? undefined,
      tailoredResumeText: record.tailoredResumeText ?? undefined,
      atsScoreBefore: (record.atsScoreBefore as TailoredResume['atsScoreBefore']) ?? undefined,
      atsScoreAfter: (record.atsScoreAfter as TailoredResume['atsScoreAfter']) ?? undefined,
      changesApplied: (record.changesApplied as TailoredResume['changesApplied']) ?? [],
      changesRejected: (record.changesRejected as TailoredResume['changesRejected']) ?? [],
      hallucinationCheck: (record.hallucinationCheck as TailoredResume['hallucinationCheck']) ?? undefined,
      confidence: record.confidence ?? undefined,
      recruiterNotes: record.recruiterNotes ?? undefined,
      tailoringAlgorithmVersion: record.tailoringAlgorithmVersion ?? undefined,
      atsWeightsVersion: record.atsWeightsVersion ?? undefined,
      promptVersions: (record.promptVersions as Record<string, string>) ?? {},
      error: record.error ?? undefined,
      retryCount: record.retryCount,
      createdAt: record.createdAt,
      startedAt: record.startedAt ?? undefined,
      completedAt: record.completedAt ?? undefined,
      updatedAt: record.updatedAt,
    };
  }

  static toPersistence(entity: TailoredResume): {
    id: string;
    status: TailoringStatus;
    currentStage: TailoringStage;
    stageExecutions: object;
    inputHash: string;
    vacancyRequirements: object | undefined;
    skillMatrix: object | undefined;
    tailoredContent: object | undefined;
    tailoredResumeText: string | null;
    atsScoreBefore: object | undefined;
    atsScoreAfter: object | undefined;
    changesApplied: object;
    changesRejected: object;
    hallucinationCheck: object | undefined;
    confidence: number | null;
    recruiterNotes: string | null;
    tailoringAlgorithmVersion: string | null;
    atsWeightsVersion: string | null;
    promptVersions: object;
    error: string | null;
    retryCount: number;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
    userId: string;
    resumeId: string;
    vacancyId: string;
    applicationId: string | null;
  } {
    return {
      id: entity.id,
      status: entity.status,
      currentStage: entity.currentStage,
      stageExecutions: entity.stageExecutions as unknown as object,
      inputHash: entity.inputHash,
      vacancyRequirements: entity.vacancyRequirements as unknown as object | undefined,
      skillMatrix: entity.skillMatrix as unknown as object | undefined,
      tailoredContent: entity.tailoredContent as unknown as object | undefined,
      tailoredResumeText: entity.tailoredResumeText ?? null,
      atsScoreBefore: entity.atsScoreBefore as unknown as object | undefined,
      atsScoreAfter: entity.atsScoreAfter as unknown as object | undefined,
      changesApplied: entity.changesApplied as unknown as object,
      changesRejected: entity.changesRejected as unknown as object,
      hallucinationCheck: entity.hallucinationCheck as unknown as object | undefined,
      confidence: entity.confidence ?? null,
      recruiterNotes: entity.recruiterNotes ?? null,
      tailoringAlgorithmVersion: entity.tailoringAlgorithmVersion ?? null,
      atsWeightsVersion: entity.atsWeightsVersion ?? null,
      promptVersions: entity.promptVersions as unknown as object,
      error: entity.error ?? null,
      retryCount: entity.retryCount,
      createdAt: entity.createdAt,
      startedAt: entity.startedAt ?? null,
      completedAt: entity.completedAt ?? null,
      updatedAt: entity.updatedAt,
      userId: entity.userId,
      resumeId: entity.resumeId,
      vacancyId: entity.vacancyId,
      applicationId: entity.applicationId ?? null,
    };
  }
}

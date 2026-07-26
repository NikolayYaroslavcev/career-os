import type { ResumeId, UserId } from '../base/identifier.js';
import type { Resume } from '../entities/resume.js';
import type { ResumeVersionStatus } from '../enums/resume-version-status.js';

export interface ResumeMetadata {
  readonly originalFile?: string;
  readonly fileName?: string;
  readonly fileType?: string;
  readonly fileSize?: number;
  readonly rawText?: string;
  readonly workspaceId?: string;
}

export interface ResumeListCriteria {
  readonly status?: ResumeVersionStatus;
  readonly tag?: string;
}

export interface ResumeRepository {
  findById(id: ResumeId): Promise<Resume | null>;
  findByIds(ids: readonly ResumeId[]): Promise<Resume[]>;
  findByUserId(userId: UserId, criteria?: ResumeListCriteria): Promise<Resume[]>;
  findDefaultByUserId(userId: UserId): Promise<Resume | null>;
  save(resume: Resume, metadata?: ResumeMetadata): Promise<void>;
  delete(id: ResumeId): Promise<void>;
  exists(id: ResumeId): Promise<boolean>;
}

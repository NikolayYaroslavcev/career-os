import type { ResumeId } from '../base/identifier.js';
import type { StructuredResume } from '../entities/structured-resume.js';

export interface StructuredResumeRepository {
  findByResumeId(resumeId: ResumeId): Promise<StructuredResume | null>;
  upsert(structuredResume: StructuredResume): Promise<void>;
}

import type { TailoredResume } from './tailored-resume.js';

export interface TailoredResumeRepository {
  save(tailoredResume: TailoredResume): Promise<void>;
  findById(id: string): Promise<TailoredResume | null>;
  /** The canonical reuse/idempotency lookup: one tailored resume per (resume, vacancy) pair. */
  findByResumeIdAndVacancyId(resumeId: string, vacancyId: string): Promise<TailoredResume | null>;
}

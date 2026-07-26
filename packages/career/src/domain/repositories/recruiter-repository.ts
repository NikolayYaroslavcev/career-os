import type { RecruiterId, CompanyId } from '../base/identifier.js';
import type { Recruiter } from '../entities/recruiter.js';

export interface RecruiterRepository {
  findById(id: RecruiterId): Promise<Recruiter | null>;
  /** Like findById, but returns null (not just any recruiter) unless it belongs to workspaceId. */
  findByIdForWorkspace(id: RecruiterId, workspaceId: string): Promise<Recruiter | null>;
  findByCompanyId(companyId: CompanyId): Promise<Recruiter[]>;
  findByWorkspaceId(workspaceId: string): Promise<Recruiter[]>;
  save(recruiter: Recruiter, options: { workspaceId?: string }): Promise<void>;
  delete(id: RecruiterId): Promise<void>;
  exists(id: RecruiterId): Promise<boolean>;
}

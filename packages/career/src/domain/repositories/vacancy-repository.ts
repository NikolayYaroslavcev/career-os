import type { VacancyId, CompanyId } from '../base/identifier.js';
import type { Vacancy } from '../entities/vacancy.js';

export interface SaveVacancyOptions {
  workspaceId: string;
}

export type VacancySortField = 'newest' | 'salary' | 'relevance' | 'company' | 'title';
export type VacancySortOrder = 'asc' | 'desc';

export interface VacancyListCriteria {
  /** Restricts results to vacancies owned by this workspace. Required — vacancies are workspace-scoped data. */
  workspaceId: string;
  query?: string;
  location?: string;
  remote?: 'onsite' | 'remote' | 'hybrid' | 'unknown';
  salaryMin?: number;
  salaryMax?: number;
  /** Filter by company name (partial match) */
  company?: string;
  /** Filter by provider/source id (e.g. 'hh', 'linkedin') */
  source?: string;
  /** Filter by experience level */
  experienceLevel?: string;
  /** Filter by employment type */
  employmentType?: string;
  /** Filter by technology/skill */
  technology?: string;
  /** Filter by minimum publication date */
  publishedAfter?: Date;
  /** Filter by maximum publication date */
  publishedBefore?: Date;
  /** Sort field and order */
  sortBy?: VacancySortField;
  sortOrder?: VacancySortOrder;
  limit: number;
  offset: number;
}

export interface VacancyListResult {
  vacancies: Vacancy[];
  total: number;
}

export interface VacancyRepository {
  findById(id: VacancyId): Promise<Vacancy | null>;
  /** Like findById, but returns null (not just any vacancy) unless it belongs to workspaceId. */
  findByIdForWorkspace(id: VacancyId, workspaceId: string): Promise<Vacancy | null>;
  findByIds(ids: readonly VacancyId[]): Promise<Vacancy[]>;
  findByCompanyId(companyId: CompanyId): Promise<Vacancy[]>;
  /** Scoped to a single workspace — used for cross-source canonical-vacancy merging within that workspace only. */
  findByTitleAndCompany(title: string, companyId: CompanyId, workspaceId: string): Promise<Vacancy | null>;
  findMany(criteria: VacancyListCriteria): Promise<VacancyListResult>;
  save(vacancy: Vacancy, options: SaveVacancyOptions): Promise<void>;
  delete(id: VacancyId): Promise<void>;
  exists(id: VacancyId): Promise<boolean>;
  /** Get aggregate stats for dashboard */
  getStats(workspaceId: string): Promise<VacancyStats>;
}

export interface VacancyStats {
  totalJobs: number;
  newToday: number;
  sources: Array<{ source: string; count: number }>;
  totalSources: number;
  lastSyncAt: Date | null;
}

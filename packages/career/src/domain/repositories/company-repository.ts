import type { CompanyId } from '../base/identifier.js';
import type { Company } from '../entities/company.js';

export interface SaveCompanyOptions {
  workspaceId: string;
}

export interface CompanyRepository {
  findById(id: CompanyId): Promise<Company | null>;
  /** Like findById, but returns null (not just any company) unless it belongs to workspaceId. */
  findByIdForWorkspace(id: CompanyId, workspaceId: string): Promise<Company | null>;
  findByIds(ids: readonly CompanyId[]): Promise<Company[]>;
  findByName(name: string): Promise<Company | null>;
  save(company: Company, options: SaveCompanyOptions): Promise<void>;
  delete(id: CompanyId): Promise<void>;
  exists(id: CompanyId): Promise<boolean>;
}

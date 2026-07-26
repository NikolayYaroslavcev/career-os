import type { VacancyId } from '../base/identifier.js';
import type { VacancyMergeAudit } from '../entities/vacancy-merge-audit.js';

export interface MergeAuditRepository {
  findByVacancyId(vacancyId: VacancyId): Promise<VacancyMergeAudit[]>;
  save(audit: VacancyMergeAudit): Promise<void>;
}

export interface CompanyWatchSyncLogData {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  jobsFound: number;
  newJobs: number;
  removedJobs: number;
  changedJobs: number;
  durationMs?: number;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  companyWatchId: string;
}

export interface CompanyWatchSyncLogRepository {
  findById(id: string): Promise<CompanyWatchSyncLogData | null>;
  findAllByCompanyWatch(companyWatchId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<CompanyWatchSyncLogData[]>;
  create(log: CompanyWatchSyncLogData): Promise<CompanyWatchSyncLogData>;
  update(log: CompanyWatchSyncLogData): Promise<CompanyWatchSyncLogData>;
  delete(id: string): Promise<void>;
  findLatestByCompanyWatch(companyWatchId: string): Promise<CompanyWatchSyncLogData | null>;
}

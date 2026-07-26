export type SyncStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface CompanyWatchSyncLogProps {
  id: string;
  status: SyncStatus;
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

export class CompanyWatchSyncLog {
  private constructor(private readonly props: CompanyWatchSyncLogProps) {}

  static create(props: Omit<CompanyWatchSyncLogProps, 'startedAt' | 'jobsFound' | 'newJobs' | 'removedJobs' | 'changedJobs'>): CompanyWatchSyncLog {
    return new CompanyWatchSyncLog({
      ...props,
      startedAt: new Date(),
      jobsFound: 0,
      newJobs: 0,
      removedJobs: 0,
      changedJobs: 0,
    });
  }

  static reconstitute(props: CompanyWatchSyncLogProps): CompanyWatchSyncLog {
    return new CompanyWatchSyncLog(props);
  }

  get id(): string {
    return this.props.id;
  }

  get status(): SyncStatus {
    return this.props.status;
  }

  get jobsFound(): number {
    return this.props.jobsFound;
  }

  get newJobs(): number {
    return this.props.newJobs;
  }

  get removedJobs(): number {
    return this.props.removedJobs;
  }

  get changedJobs(): number {
    return this.props.changedJobs;
  }

  get durationMs(): number | undefined {
    return this.props.durationMs;
  }

  get error(): string | undefined {
    return this.props.error;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  get companyWatchId(): string {
    return this.props.companyWatchId;
  }

  markRunning(): void {
    this.props.status = 'RUNNING';
  }

  complete(stats: { jobsFound: number; newJobs: number; removedJobs: number; changedJobs: number; durationMs: number }): void {
    this.props.status = 'SUCCESS';
    this.props.jobsFound = stats.jobsFound;
    this.props.newJobs = stats.newJobs;
    this.props.removedJobs = stats.removedJobs;
    this.props.changedJobs = stats.changedJobs;
    this.props.durationMs = stats.durationMs;
    this.props.completedAt = new Date();
  }

  fail(error: string, durationMs?: number): void {
    this.props.status = 'FAILED';
    this.props.error = error;
    this.props.durationMs = durationMs;
    this.props.completedAt = new Date();
  }

  toProps(): CompanyWatchSyncLogProps {
    return { ...this.props };
  }
}

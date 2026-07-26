import type { CompanyWatchEventRepository, CompanyWatchSyncLogRepository, CompanyWatchEventData, CompanyWatchSyncLogData } from '../domain/repositories/index.js';
import type { NormalizedJob } from './normalization-service.js';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface JobChange {
  type: 'NEW_JOB' | 'REMOVED_JOB' | 'CHANGED_JOB';
  job: NormalizedJob;
  previousJob?: NormalizedJob;
}

export class DeduplicationService {
  constructor(
    private readonly eventRepo: CompanyWatchEventRepository,
    private readonly syncLogRepo: CompanyWatchSyncLogRepository
  ) {}

  async detectChanges(
    companyWatchId: string,
    currentJobs: NormalizedJob[]
  ): Promise<JobChange[]> {
    // Get the latest sync log to find previous jobs
    const latestSync = await this.syncLogRepo.findLatestByCompanyWatch(companyWatchId);

    // If no previous sync, all jobs are new
    if (!latestSync || latestSync.status !== 'SUCCESS') {
      return currentJobs.map((job) => ({
        type: 'NEW_JOB' as const,
        job,
      }));
    }

    // Get previous events to reconstruct the previous state
    const previousEvents = await this.eventRepo.findAllByCompanyWatch(companyWatchId, {
      type: 'NEW_JOB',
      limit: 1000,
    });

    // Build a map of previous jobs by external ID
    const previousJobsMap = new Map<string, NormalizedJob>();
    for (const event of previousEvents) {
      if (event.externalId) {
        previousJobsMap.set(event.externalId, {
          externalId: event.externalId,
          title: event.title || '',
          description: event.description || '',
          url: event.url || '',
          location: event.location,
          salary: event.salary as NormalizedJob['salary'],
          technologies: event.technologies,
          publishedAt: event.publishedAt,
          companyWatchId,
          contentHash: '',
        });
      }
    }

    const changes: JobChange[] = [];
    const currentIds = new Set(currentJobs.map((j) => j.externalId));

    // Find new and changed jobs
    for (const currentJob of currentJobs) {
      const previousJob = previousJobsMap.get(currentJob.externalId);
      if (!previousJob) {
        // New job
        changes.push({
          type: 'NEW_JOB',
          job: currentJob,
        });
      } else if (previousJob.contentHash !== currentJob.contentHash) {
        // Changed job
        changes.push({
          type: 'CHANGED_JOB',
          job: currentJob,
          previousJob,
        });
      }
    }

    // Find removed jobs
    for (const [externalId, previousJob] of previousJobsMap) {
      if (!currentIds.has(externalId)) {
        changes.push({
          type: 'REMOVED_JOB',
          job: previousJob,
          previousJob,
        });
      }
    }

    return changes;
  }

  async createEvents(
    companyWatchId: string,
    changes: JobChange[]
  ): Promise<CompanyWatchEventData[]> {
    const events: CompanyWatchEventData[] = [];

    for (const change of changes) {
      const event: CompanyWatchEventData = {
        id: generateId(),
        type: change.type,
        externalId: change.job.externalId,
        title: change.job.title,
        description: change.job.description,
        url: change.job.url,
        location: change.job.location,
        salary: change.job.salary,
        technologies: change.job.technologies,
        publishedAt: change.job.publishedAt,
        detectedAt: new Date(),
        processed: false,
        companyWatchId,
      };

      const created = await this.eventRepo.create(event);
      events.push(created);
    }

    return events;
  }

  async createSyncLog(
    companyWatchId: string,
    stats: { jobsFound: number; newJobs: number; removedJobs: number; changedJobs: number; durationMs: number }
  ): Promise<CompanyWatchSyncLogData> {
    const log: CompanyWatchSyncLogData = {
      id: generateId(),
      status: 'SUCCESS',
      jobsFound: stats.jobsFound,
      newJobs: stats.newJobs,
      removedJobs: stats.removedJobs,
      changedJobs: stats.changedJobs,
      durationMs: stats.durationMs,
      startedAt: new Date(),
      completedAt: new Date(),
      companyWatchId,
    };

    return this.syncLogRepo.create(log);
  }

  async createFailedSyncLog(
    companyWatchId: string,
    error: string,
    durationMs?: number
  ): Promise<CompanyWatchSyncLogData> {
    const log: CompanyWatchSyncLogData = {
      id: generateId(),
      status: 'FAILED',
      jobsFound: 0,
      newJobs: 0,
      removedJobs: 0,
      changedJobs: 0,
      durationMs,
      error,
      startedAt: new Date(),
      completedAt: new Date(),
      companyWatchId,
    };

    return this.syncLogRepo.create(log);
  }
}

import { prisma } from '../client.js';

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

export class PrismaCompanyWatchSyncLogRepository {
  async findById(id: string): Promise<CompanyWatchSyncLogData | null> {
    const record = await prisma.companyWatchSyncLog.findUnique({
      where: { id },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async findAllByCompanyWatch(
    companyWatchId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ): Promise<CompanyWatchSyncLogData[]> {
    const records = await prisma.companyWatchSyncLog.findMany({
      where: {
        companyWatchId,
        ...(options?.status ? { status: options.status as 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    });

    return records.map(this.toDomain);
  }

  async create(data: CompanyWatchSyncLogData): Promise<CompanyWatchSyncLogData> {
    const record = await prisma.companyWatchSyncLog.create({
      data: this.toPersistence(data),
    });

    return this.toDomain(record);
  }

  async update(data: CompanyWatchSyncLogData): Promise<CompanyWatchSyncLogData> {
    const record = await prisma.companyWatchSyncLog.update({
      where: { id: data.id },
      data: {
        status: data.status,
        jobsFound: data.jobsFound,
        newJobs: data.newJobs,
        removedJobs: data.removedJobs,
        changedJobs: data.changedJobs,
        durationMs: data.durationMs,
        error: data.error,
        completedAt: data.completedAt,
      },
    });

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await prisma.companyWatchSyncLog.delete({
      where: { id },
    });
  }

  async findLatestByCompanyWatch(companyWatchId: string): Promise<CompanyWatchSyncLogData | null> {
    const record = await prisma.companyWatchSyncLog.findFirst({
      where: { companyWatchId },
      orderBy: { startedAt: 'desc' },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  private toDomain(record: {
    id: string;
    status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
    jobsFound: number;
    newJobs: number;
    removedJobs: number;
    changedJobs: number;
    durationMs: number | null;
    error: string | null;
    startedAt: Date;
    completedAt: Date | null;
    companyWatchId: string;
  }): CompanyWatchSyncLogData {
    return {
      id: record.id,
      status: record.status,
      jobsFound: record.jobsFound,
      newJobs: record.newJobs,
      removedJobs: record.removedJobs,
      changedJobs: record.changedJobs,
      durationMs: record.durationMs ?? undefined,
      error: record.error ?? undefined,
      startedAt: record.startedAt,
      completedAt: record.completedAt ?? undefined,
      companyWatchId: record.companyWatchId,
    };
  }

  private toPersistence(data: CompanyWatchSyncLogData): {
    status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
    jobsFound: number;
    newJobs: number;
    removedJobs: number;
    changedJobs: number;
    durationMs: number | undefined;
    error: string | undefined;
    startedAt: Date;
    completedAt: Date | undefined;
    companyWatchId: string;
  } {
    return {
      status: data.status,
      jobsFound: data.jobsFound,
      newJobs: data.newJobs,
      removedJobs: data.removedJobs,
      changedJobs: data.changedJobs,
      durationMs: data.durationMs,
      error: data.error,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      companyWatchId: data.companyWatchId,
    };
  }
}

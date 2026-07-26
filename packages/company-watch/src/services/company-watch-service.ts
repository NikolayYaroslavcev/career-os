import type { CompanyWatchRepository, CompanyWatchEventRepository, CompanyWatchSyncLogRepository, CompanyWatchData } from '../domain/repositories/index.js';
import { AtsAdapterRegistry } from '../adapters/adapter-registry.js';
import { NormalizationService } from './normalization-service.js';
import { DeduplicationService } from './deduplication-service.js';
import { assertSafeUrl } from '../utils/url-safety.js';

export interface SyncResult {
  companyWatchId: string;
  jobsFound: number;
  newJobs: number;
  removedJobs: number;
  changedJobs: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class CompanyWatchService {
  private readonly normalizationService = new NormalizationService();

  constructor(
    private readonly companyWatchRepo: CompanyWatchRepository,
    private readonly eventRepo: CompanyWatchEventRepository,
    private readonly syncLogRepo: CompanyWatchSyncLogRepository,
    private readonly adapterRegistry: AtsAdapterRegistry
  ) {}

  async syncCompany(companyWatchId: string): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      const company = await this.companyWatchRepo.findById(companyWatchId);
      if (!company) {
        throw new Error(`Company watch not found: ${companyWatchId}`);
      }

      await assertSafeUrl(company.careerUrl);
      if (company.atsEndpoint) {
        await assertSafeUrl(company.atsEndpoint);
      }

      const adapter = this.adapterRegistry.get(company.atsType as AtsType);

      // Fetch current jobs from ATS
      const atsJobs = await adapter.fetchJobs({
        careerUrl: company.careerUrl,
        atsEndpoint: company.atsEndpoint,
        metadata: company.metadata,
      });

      // Normalize jobs
      const normalizedJobs = atsJobs.map((job) =>
        this.normalizationService.normalize(job, company)
      );

      // Detect changes
      const deduplicationService = new DeduplicationService(this.eventRepo, this.syncLogRepo);
      const changes = await deduplicationService.detectChanges(companyWatchId, normalizedJobs);

      // Create events
      await deduplicationService.createEvents(companyWatchId, changes);

      // Calculate stats
      const stats = {
        jobsFound: atsJobs.length,
        newJobs: changes.filter((c) => c.type === 'NEW_JOB').length,
        removedJobs: changes.filter((c) => c.type === 'REMOVED_JOB').length,
        changedJobs: changes.filter((c) => c.type === 'CHANGED_JOB').length,
        durationMs: Date.now() - startTime,
      };

      // Create sync log
      await deduplicationService.createSyncLog(companyWatchId, stats);

      // Update company sync status
      const updatedCompany: CompanyWatchData = {
        ...company,
        lastSyncStatus: 'success',
        lastSyncAt: new Date(),
        lastSyncError: undefined,
        updatedAt: new Date(),
      };
      await this.companyWatchRepo.update(updatedCompany);

      return {
        companyWatchId,
        ...stats,
        success: true,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Create failed sync log
      const deduplicationService = new DeduplicationService(this.eventRepo, this.syncLogRepo);
      await deduplicationService.createFailedSyncLog(companyWatchId, errorMessage, durationMs);

      // Update company sync status
      const company = await this.companyWatchRepo.findById(companyWatchId);
      if (company) {
        const updatedCompany: CompanyWatchData = {
          ...company,
          lastSyncStatus: 'failed',
          lastSyncAt: new Date(),
          lastSyncError: errorMessage,
          updatedAt: new Date(),
        };
        await this.companyWatchRepo.update(updatedCompany);
      }

      return {
        companyWatchId,
        jobsFound: 0,
        newJobs: 0,
        removedJobs: 0,
        changedJobs: 0,
        durationMs,
        success: false,
        error: errorMessage,
      };
    }
  }

  async syncAll(): Promise<SyncResult[]> {
    const activeCompanies = await this.companyWatchRepo.findAllActive();
    const results: SyncResult[] = [];

    for (const company of activeCompanies) {
      if (this.shouldSync(company)) {
        const result = await this.syncCompany(company.id);
        results.push(result);
      }
    }

    return results;
  }

  private shouldSync(company: CompanyWatchData): boolean {
    if (!company.lastSyncAt) return true;
    const elapsed = Date.now() - company.lastSyncAt.getTime();
    return elapsed >= company.pollingInterval * 1000;
  }

  async getCompanyEvents(
    companyWatchId: string,
    options?: { type?: string; limit?: number; offset?: number }
  ) {
    return this.eventRepo.findAllByCompanyWatch(companyWatchId, options);
  }

  async getCompanyById(id: string) {
    return this.companyWatchRepo.findById(id);
  }

  /** Fetches a watched company and verifies it belongs to workspaceId; returns
   * null (not found) rather than the record if it belongs to another workspace. */
  async getOwned(id: string, workspaceId: string): Promise<CompanyWatchData | null> {
    const company = await this.companyWatchRepo.findById(id);
    if (!company || company.workspaceId !== workspaceId) {
      return null;
    }
    return company;
  }

  async listCompaniesByWorkspace(workspaceId: string) {
    return this.companyWatchRepo.findAllByWorkspace(workspaceId);
  }

  async addCompany(data: Omit<CompanyWatchData, 'id' | 'createdAt' | 'updatedAt'>) {
    await assertSafeUrl(data.careerUrl);
    if (data.atsEndpoint) {
      await assertSafeUrl(data.atsEndpoint);
    }

    const id = generateId();
    const now = new Date();
    const company: CompanyWatchData = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    return this.companyWatchRepo.create(company);
  }

  async updateCompany(id: string, workspaceId: string, data: Partial<CompanyWatchData>) {
    const existing = await this.getOwned(id, workspaceId);
    if (!existing) return null;

    if (data.careerUrl) {
      await assertSafeUrl(data.careerUrl);
    }
    if (data.atsEndpoint) {
      await assertSafeUrl(data.atsEndpoint);
    }

    const updated: CompanyWatchData = {
      ...existing,
      ...data,
      id: existing.id,
      workspaceId: existing.workspaceId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    return this.companyWatchRepo.update(updated);
  }

  async removeCompany(id: string, workspaceId: string) {
    const existing = await this.getOwned(id, workspaceId);
    if (!existing) return false;

    try {
      await this.companyWatchRepo.delete(id);
      return true;
    } catch {
      return false;
    }
  }
}

import type { AtsType } from '../domain/value-objects/ats-type.js';

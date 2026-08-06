import { describe, it, expect, vi } from 'vitest';
import type { Queue } from 'bullmq';
import type { CompanyWatchRepository, CompanyWatchData } from '@careeros/company-watch';
import type { CompanyWatchSyncJob } from '@careeros/shared';
import { sweepDueCompanies } from '../company-watch-scheduler-processor.js';

function makeCompany(overrides: Partial<CompanyWatchData> = {}): CompanyWatchData {
  const now = new Date();
  return {
    id: 'company-1',
    name: 'Acme',
    aliases: [],
    languages: ['en'],
    tags: [],
    atsType: 'CUSTOM_HTML',
    careerUrl: 'https://example.com/careers',
    pollingInterval: 3600,
    active: true,
    workspaceId: 'workspace-1',
    createdAt: now,
    updatedAt: now,
    consecutiveFailureCount: 0,
    healthStatus: 'ACTIVE',
    priorityScore: 50,
    ...overrides,
  };
}

function makeRepository(companies: CompanyWatchData[]): CompanyWatchRepository {
  return {
    findById: vi.fn(),
    findByName: vi.fn(),
    findAllByWorkspace: vi.fn(),
    findAllActive: vi.fn().mockResolvedValue(companies),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  };
}

describe('sweepDueCompanies', () => {
  it('enqueues a sync job only for companies whose shouldSync() is true', async () => {
    const due = makeCompany({ id: 'due-1', lastSyncAt: undefined });
    const notDue = makeCompany({ id: 'not-due-1', lastSyncAt: new Date(), pollingInterval: 3600 });
    const repository = makeRepository([due, notDue]);
    const add = vi.fn().mockResolvedValue(undefined);
    const syncQueue = { add } as unknown as Queue<CompanyWatchSyncJob>;

    const result = await sweepDueCompanies({ companyWatchRepository: repository, syncQueue });

    expect(result).toEqual({ scanned: 2, enqueued: 1 });
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      'company-watch-sync',
      { companyWatchId: 'due-1' },
      expect.objectContaining({ jobId: 'due-1' })
    );
  });

  it('enqueues nothing when no active company is due', async () => {
    const notDue = makeCompany({ lastSyncAt: new Date() });
    const repository = makeRepository([notDue]);
    const add = vi.fn();
    const syncQueue = { add } as unknown as Queue<CompanyWatchSyncJob>;

    const result = await sweepDueCompanies({ companyWatchRepository: repository, syncQueue });

    expect(result).toEqual({ scanned: 1, enqueued: 0 });
    expect(add).not.toHaveBeenCalled();
  });
});

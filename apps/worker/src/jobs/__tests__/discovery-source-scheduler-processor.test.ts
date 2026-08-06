import { describe, it, expect, vi } from 'vitest';
import type { Queue } from 'bullmq';
import type { DiscoverySourceConfigData, DiscoverySourceConfigRepository } from '@careeros/discovery-sources';
import type { DiscoverySourceRunJob } from '@careeros/shared';
import { sweepDueDiscoverySources } from '../discovery-source-scheduler-processor.js';

function makeSource(overrides: Partial<DiscoverySourceConfigData> = {}): DiscoverySourceConfigData {
  const now = new Date();
  return {
    id: 'row-1',
    sourceId: 'cncf_landscape',
    enabled: true,
    cursor: null,
    lastRunAt: null,
    lastRunStatus: null,
    lastRunError: null,
    candidatesFound: 0,
    candidatesEnrolled: 0,
    candidatesRejected: 0,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeConfigRepository(sources: DiscoverySourceConfigData[]): DiscoverySourceConfigRepository {
  return {
    findBySourceId: vi.fn(),
    findAllEnabled: vi.fn().mockResolvedValue(sources),
    findAll: vi.fn(),
    update: vi.fn(),
    ensureRegistered: vi.fn(),
  };
}

describe('sweepDueDiscoverySources', () => {
  it('enqueues a run job for a source that has never run', async () => {
    const due = makeSource({ sourceId: 'cncf_landscape', lastRunAt: null });
    const configRepository = makeConfigRepository([due]);
    const add = vi.fn().mockResolvedValue(undefined);
    const runQueue = { add } as unknown as Queue<DiscoverySourceRunJob>;

    const result = await sweepDueDiscoverySources({ configRepository, runQueue });

    expect(result).toEqual({ scanned: 1, enqueued: 1 });
    expect(add).toHaveBeenCalledWith(
      'discovery-source-run',
      { sourceId: 'cncf_landscape' },
      expect.objectContaining({ jobId: 'cncf_landscape' })
    );
  });

  it('skips a source whose own cadence interval has not elapsed yet', async () => {
    // cncf_landscape's configured interval is 30 days — 1 hour ago is nowhere near due.
    const notDue = makeSource({ sourceId: 'cncf_landscape', lastRunAt: new Date(Date.now() - 60 * 60 * 1000) });
    const configRepository = makeConfigRepository([notDue]);
    const add = vi.fn();
    const runQueue = { add } as unknown as Queue<DiscoverySourceRunJob>;

    const result = await sweepDueDiscoverySources({ configRepository, runQueue });

    expect(result).toEqual({ scanned: 1, enqueued: 0 });
    expect(add).not.toHaveBeenCalled();
  });

  it('enqueues a source once its own interval has elapsed', async () => {
    // rss_career_feed's configured interval is 7 days.
    const due = makeSource({
      sourceId: 'rss_career_feed',
      lastRunAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });
    const configRepository = makeConfigRepository([due]);
    const add = vi.fn().mockResolvedValue(undefined);
    const runQueue = { add } as unknown as Queue<DiscoverySourceRunJob>;

    const result = await sweepDueDiscoverySources({ configRepository, runQueue });

    expect(result).toEqual({ scanned: 1, enqueued: 1 });
  });

  it('only scans sources findAllEnabled returns — disabled sources are invisible to the scheduler', async () => {
    // findAllEnabled itself is responsible for the enabled filter; verify the
    // sweep does not additionally re-check `enabled` (it trusts the repository).
    const configRepository = makeConfigRepository([]);
    const add = vi.fn();
    const runQueue = { add } as unknown as Queue<DiscoverySourceRunJob>;

    const result = await sweepDueDiscoverySources({ configRepository, runQueue });

    expect(configRepository.findAllEnabled).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scanned: 0, enqueued: 0 });
    expect(add).not.toHaveBeenCalled();
  });
});

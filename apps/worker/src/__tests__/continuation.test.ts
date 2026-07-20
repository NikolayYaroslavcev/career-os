import { describe, it, expect, vi } from 'vitest';
import { InMemoryAiBatchBacklog } from '@careeros/shared';
import { createContinuationHandler } from '../continuation.js';

function buildLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

describe('createContinuationHandler (EPIC-17 Part 6 — continuous background processing)', () => {
  it('enqueues the next batch from the backlog with the shared jobId dedup convention', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    await backlog.push('profile-1', ['v1', 'v2', 'v3']);
    const addBulk = vi.fn().mockResolvedValue([]);
    const logger = buildLogger();

    const continueBatch = createContinuationHandler({
      backlog,
      queue: { addBulk },
      batchSize: 2,
      logger,
    });

    await continueBatch('profile-1');

    expect(addBulk).toHaveBeenCalledTimes(1);
    const jobs = addBulk.mock.calls[0]![0];
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      name: 'analyze-vacancy',
      data: { vacancyId: 'v1', searchProfileId: 'profile-1' },
      opts: { jobId: 'profile-1__v1' },
    });
    expect(await backlog.remaining('profile-1')).toBe(1);
  });

  it('is a no-op once the backlog is empty — this is how the batch chain terminates', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    const addBulk = vi.fn();
    const logger = buildLogger();

    const continueBatch = createContinuationHandler({ backlog, queue: { addBulk }, batchSize: 15, logger });
    await continueBatch('profile-with-no-backlog');

    expect(addBulk).not.toHaveBeenCalled();
  });

  it('drains a large backlog across repeated completions instead of stopping after one batch', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    await backlog.push('profile-1', Array.from({ length: 35 }, (_, i) => `v${i}`));
    const addBulk = vi.fn().mockResolvedValue([]);
    const logger = buildLogger();

    const continueBatch = createContinuationHandler({ backlog, queue: { addBulk }, batchSize: 15, logger });

    // Simulates worker.on('completed') firing once per finished job.
    await continueBatch('profile-1');
    await continueBatch('profile-1');
    await continueBatch('profile-1');

    // 15 + 15 + 5 = 35 popped across three completions.
    expect(addBulk).toHaveBeenCalledTimes(3);
    expect(await backlog.remaining('profile-1')).toBe(0);
  });

  it('logs and swallows a queue failure rather than throwing (a completed job must not crash the worker)', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    await backlog.push('profile-1', ['v1']);
    const addBulk = vi.fn().mockRejectedValue(new Error('redis unavailable'));
    const logger = buildLogger();

    const continueBatch = createContinuationHandler({ backlog, queue: { addBulk }, batchSize: 15, logger });

    await expect(continueBatch('profile-1')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to enqueue continuation batch',
      expect.objectContaining({ searchProfileId: 'profile-1' })
    );
  });
});

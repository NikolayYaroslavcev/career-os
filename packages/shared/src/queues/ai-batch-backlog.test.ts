import { describe, it, expect } from 'vitest';
import { InMemoryAiBatchBacklog } from './ai-batch-backlog.js';

describe('InMemoryAiBatchBacklog', () => {
  it('reports zero remaining for a search profile that was never pushed to', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    expect(await backlog.remaining('profile-1')).toBe(0);
    expect(await backlog.popBatch('profile-1', 5)).toEqual([]);
  });

  it('pops batches in FIFO order and tracks what remains', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    await backlog.push('profile-1', ['v1', 'v2', 'v3', 'v4', 'v5']);

    expect(await backlog.remaining('profile-1')).toBe(5);

    const firstBatch = await backlog.popBatch('profile-1', 2);
    expect(firstBatch).toEqual(['v1', 'v2']);
    expect(await backlog.remaining('profile-1')).toBe(3);

    const secondBatch = await backlog.popBatch('profile-1', 2);
    expect(secondBatch).toEqual(['v3', 'v4']);
    expect(await backlog.remaining('profile-1')).toBe(1);

    const finalBatch = await backlog.popBatch('profile-1', 10);
    expect(finalBatch).toEqual(['v5']);
    expect(await backlog.remaining('profile-1')).toBe(0);
  });

  it('keeps separate backlogs per search profile', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    await backlog.push('profile-1', ['a', 'b']);
    await backlog.push('profile-2', ['c']);

    expect(await backlog.remaining('profile-1')).toBe(2);
    expect(await backlog.remaining('profile-2')).toBe(1);

    const popped = await backlog.popBatch('profile-1', 10);
    expect(popped).toEqual(['a', 'b']);
    expect(await backlog.remaining('profile-2')).toBe(1);
  });

  it('appends across multiple push calls instead of overwriting', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    await backlog.push('profile-1', ['a']);
    await backlog.push('profile-1', ['b', 'c']);

    expect(await backlog.popBatch('profile-1', 10)).toEqual(['a', 'b', 'c']);
  });

  it('treats an empty push as a no-op', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    await backlog.push('profile-1', []);
    expect(await backlog.remaining('profile-1')).toBe(0);
  });

  it('returns an empty batch for a non-positive size', async () => {
    const backlog = new InMemoryAiBatchBacklog();
    await backlog.push('profile-1', ['a', 'b']);
    expect(await backlog.popBatch('profile-1', 0)).toEqual([]);
    expect(await backlog.remaining('profile-1')).toBe(2);
  });
});

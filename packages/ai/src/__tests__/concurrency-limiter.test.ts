import { describe, it, expect } from 'vitest';
import { AIConcurrencyLimiter } from '../resilience/concurrency-limiter.js';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('AIConcurrencyLimiter', () => {
  it('runs immediately when unset (unlimited)', async () => {
    const limiter = new AIConcurrencyLimiter(undefined);
    const result = await limiter.run(async () => 'ok');
    expect(result).toBe('ok');
    expect(limiter.activeCount).toBe(0);
  });

  it('runs immediately when set to 0 (treated as unlimited)', async () => {
    const limiter = new AIConcurrencyLimiter(0);
    await expect(limiter.run(async () => 'ok')).resolves.toBe('ok');
  });

  it('allows up to maxConcurrency operations to run at once', async () => {
    const limiter = new AIConcurrencyLimiter(2);
    const a = deferred<string>();
    const b = deferred<string>();

    const pA = limiter.run(() => a.promise);
    const pB = limiter.run(() => b.promise);

    expect(limiter.activeCount).toBe(2);
    a.resolve('a');
    b.resolve('b');
    await expect(pA).resolves.toBe('a');
    await expect(pB).resolves.toBe('b');
  });

  it('queues operations beyond maxConcurrency and runs them once a slot frees up', async () => {
    const limiter = new AIConcurrencyLimiter(1);
    const a = deferred<string>();
    const b = deferred<string>();

    const order: string[] = [];
    const pA = limiter.run(() => a.promise).then((v) => order.push(v));
    const pB = limiter.run(() => b.promise).then((v) => order.push(v));

    // b hasn't started yet — only one slot, held by a.
    expect(limiter.activeCount).toBe(1);
    expect(limiter.queueLength).toBe(1);

    a.resolve('a');
    await pA;
    // releasing a's slot should let b start.
    expect(limiter.activeCount).toBe(1);
    expect(limiter.queueLength).toBe(0);

    b.resolve('b');
    await pB;

    expect(order).toEqual(['a', 'b']);
  });

  it('releases the slot even when the operation throws', async () => {
    const limiter = new AIConcurrencyLimiter(1);

    await expect(
      limiter.run(async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(limiter.activeCount).toBe(0);
    // a second call should not hang, proving the slot was released.
    await expect(limiter.run(async () => 'ok')).resolves.toBe('ok');
  });
});

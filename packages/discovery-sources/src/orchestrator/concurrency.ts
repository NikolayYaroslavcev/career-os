/**
 * ADR-035 §14: "concurrency-capped, not fired as N simultaneous requests...
 * global outbound-concurrency cap so a 50,000-domain batch doesn't open
 * 50,000 sockets." Standard bounded-pool fan-out — no new BullMQ
 * per-candidate queue yet (see EPIC-18 "known limitations"), but callers
 * never run more than `limit` intake calls concurrently within one source run.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await task(items[index] as T);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

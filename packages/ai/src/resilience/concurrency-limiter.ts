/**
 * Caps how many operations run concurrently; calls beyond the limit queue
 * (FIFO) rather than being rejected — backpressure, not load-shedding.
 * `undefined`/`0` means unlimited (matches AI_MAX_CONCURRENCY being unset).
 */
export class AIConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrency: number | undefined) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.maxConcurrency || this.maxConcurrency <= 0) {
      return fn();
    }

    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get activeCount(): number {
    return this.active;
  }

  get queueLength(): number {
    return this.queue.length;
  }

  private acquire(): Promise<void> {
    if (this.active < (this.maxConcurrency as number)) {
      this.active++;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

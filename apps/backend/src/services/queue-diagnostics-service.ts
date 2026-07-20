import { Queue } from 'bullmq';
import { VACANCY_ANALYSIS_QUEUE_NAME } from '@careeros/shared';

export interface QueueJobCounts {
  readonly waiting: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly delayed: number;
}

/**
 * Read-only view of the vacancy-analysis BullMQ queue's job counts — a
 * second, stats-only Queue handle alongside the producer in
 * BullMqVacancyAnalysisQueue (BullMQ Queue instances are cheap and safe to
 * have multiple of against the same queue name).
 */
export class QueueDiagnosticsService {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(VACANCY_ANALYSIS_QUEUE_NAME, { connection: { url: redisUrl } });
  }

  async getJobCounts(): Promise<QueueJobCounts> {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    };
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

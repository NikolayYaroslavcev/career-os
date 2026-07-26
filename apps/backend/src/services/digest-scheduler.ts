import type { DigestDeliveryParams, DigestDeliveryResult } from './digest-delivery-service.js';
import type { DigestDeliveryService } from './digest-delivery-service.js';

export interface DailyScheduleConfig {
  readonly userId: string;
  readonly hourUtc: number;
  readonly minuteUtc: number;
}

/**
 * "When" a digest runs, kept separate from "how" (DigestDeliveryService).
 * MVP has no cron worker — scheduleDaily only records intent for a future
 * job runner (see EPIC-09); triggerNow is what `pnpm demo:digest` and the
 * eventual cron handler both call.
 */
export interface DigestScheduler {
  scheduleDaily(config: DailyScheduleConfig): void;
  triggerNow(params: DigestDeliveryParams): Promise<DigestDeliveryResult>;
}

export class ManualDigestScheduler implements DigestScheduler {
  private readonly scheduled = new Map<string, DailyScheduleConfig>();

  constructor(private readonly deliveryService: DigestDeliveryService) {}

  scheduleDaily(config: DailyScheduleConfig): void {
    this.scheduled.set(config.userId, config);
  }

  getScheduledConfigs(): readonly DailyScheduleConfig[] {
    return [...this.scheduled.values()];
  }

  async triggerNow(params: DigestDeliveryParams): Promise<DigestDeliveryResult> {
    return this.deliveryService.deliverNow(params);
  }
}

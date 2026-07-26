import type { SchedulePriority } from '../types/provider.js';

export interface ScheduleTrigger {
  readonly type: 'cron' | 'user_initiated' | 'event_driven' | 'manual';
  readonly providerIds: readonly string[];
  readonly workspaceId: string;
  readonly priority: SchedulePriority;
  readonly metadata?: Record<string, unknown>;
}

export interface ScheduleConfig {
  readonly providerId: string;
  readonly cronExpression: string;
  readonly enabled: boolean;
  readonly priority: SchedulePriority;
  readonly maxConcurrentRuns: number;
  readonly cooldownMs: number;
}

export interface SchedulerOutput {
  readonly runId: string;
  readonly providerId: string;
  readonly trigger: ScheduleTrigger;
  readonly scheduledAt: Date;
}

export interface Scheduler {
  schedule(trigger: ScheduleTrigger): Promise<SchedulerOutput>;
  getSchedules(): Promise<readonly ScheduleConfig[]>;
  getNextRunTime(providerId: string): Promise<Date | null>;
}

export class DefaultSyncScheduler implements Scheduler {
  private schedules = new Map<string, ScheduleConfig>();

  async schedule(trigger: ScheduleTrigger): Promise<SchedulerOutput> {
    const runId = crypto.randomUUID();
    return {
      runId,
      providerId: trigger.providerIds[0] ?? '',
      trigger,
      scheduledAt: new Date(),
    };
  }

  async getSchedules(): Promise<readonly ScheduleConfig[]> {
    return Array.from(this.schedules.values());
  }

  async getNextRunTime(_providerId: string): Promise<Date | null> {
    return null;
  }
}

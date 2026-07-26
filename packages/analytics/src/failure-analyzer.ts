import type { FailureAnalysis, FailureStage, DateRange } from './types.js';

interface ApplicationRecord {
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly appliedAt: Date | null;
  /**
   * The status the application was in immediately before its current
   * (terminal) status, derived from AnalyticsEvent status-history when
   * available. `null` means no history is available for this application
   * (e.g. it was rejected before status-change events started being
   * recorded) — those rejections are grouped under 'Unknown stage'.
   */
  readonly priorStatus?: string | null;
  /** Days spent in `priorStatus` before transitioning, when derivable from history. */
  readonly daysInPriorStage?: number | null;
}

const REJECTION_STAGES = [
  { stage: 'Before HR', checkStatuses: ['saved', 'applied', 'waiting'] },
  { stage: 'After HR', checkStatuses: ['hr_interview'] },
  { stage: 'After Technical', checkStatuses: ['technical_interview'] },
  { stage: 'After Final', checkStatuses: ['final_interview'] },
] as const;

const UNKNOWN_STAGE = 'Unknown stage';

export function analyzeFailures(
  applications: readonly ApplicationRecord[],
  period: DateRange,
): FailureAnalysis {
  const rejected = applications.filter((a) => a.status === 'rejected');
  const withdrawn = applications.filter((a) => a.status === 'archived');
  const expired: readonly ApplicationRecord[] = [];

  const buckets = new Map<string, ApplicationRecord[]>();
  for (const stageConfig of REJECTION_STAGES) {
    buckets.set(stageConfig.stage, []);
  }
  buckets.set(UNKNOWN_STAGE, []);

  for (const app of rejected) {
    const stageConfig = app.priorStatus
      ? REJECTION_STAGES.find((s) => (s.checkStatuses as readonly string[]).includes(app.priorStatus as string))
      : undefined;
    const bucket = buckets.get(stageConfig?.stage ?? UNKNOWN_STAGE);
    bucket?.push(app);
  }

  const stageNames = [...REJECTION_STAGES.map((s) => s.stage), UNKNOWN_STAGE];
  const stages: FailureStage[] = stageNames
    .map((stageName) => {
      const apps = buckets.get(stageName) ?? [];
      const count = apps.length;
      const percentage = rejected.length > 0 ? Math.round((count / rejected.length) * 10000) / 100 : 0;
      const knownDurations = apps
        .map((a) => a.daysInPriorStage)
        .filter((d): d is number => typeof d === 'number');
      const avgDaysInStage = knownDurations.length > 0
        ? Math.round(knownDurations.reduce((s, d) => s + d, 0) / knownDurations.length)
        : 0;

      return {
        stage: stageName,
        status: 'rejected',
        count,
        percentage,
        avgDaysInStage,
      };
    })
    .filter((s) => s.stage !== UNKNOWN_STAGE || s.count > 0);

  const topStage = rejected.length > 0 ? [...stages].sort((a, b) => b.count - a.count)[0] : undefined;
  const primaryFailurePoint = topStage ? topStage.stage : 'No data';

  return {
    totalRejected: rejected.length,
    totalWithdrawn: withdrawn.length,
    totalExpired: expired.length,
    stages,
    primaryFailurePoint,
    period,
  };
}

export function computeRejectionBreakdown(
  applications: readonly ApplicationRecord[],
): readonly { readonly stage: string; readonly count: number; readonly percentage: number }[] {
  const rejected = applications.filter((a) => a.status === 'rejected');
  const total = rejected.length;

  if (total === 0) return [];

  const counts = {
    'No response': 0,
    'After application': 0,
    'After HR': 0,
    'After technical': 0,
    'After final': 0,
  };

  const now = new Date();
  for (const app of rejected) {
    const daysSinceApplied = app.appliedAt
      ? Math.floor((now.getTime() - app.appliedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysSinceApplied <= 7) counts['No response'] += 1;
    else if (daysSinceApplied <= 14) counts['After application'] += 1;
    else if (daysSinceApplied <= 30) counts['After HR'] += 1;
    else if (daysSinceApplied <= 60) counts['After technical'] += 1;
    else counts['After final'] += 1;
  }

  return Object.entries(counts)
    .map(([stage, count]) => ({
      stage,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }))
    .filter((item) => item.count > 0);
}

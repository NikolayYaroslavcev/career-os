import type { TimeAnalytics, TimeMetric, DateRange } from './types.js';
import { median } from './stats-utils.js';

interface ApplicationRecord {
  readonly status: string;
  readonly createdAt: Date;
  readonly appliedAt: Date | null;
  readonly updatedAt: Date;
}

function computeTimeMetric(
  label: string,
  days: readonly number[],
): TimeMetric {
  if (days.length === 0) {
    return {
      label,
      avgDays: 0,
      medianDays: 0,
      minDays: 0,
      maxDays: 0,
      sampleSize: 0,
    };
  }

  const sorted = [...days].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);

  return {
    label,
    avgDays: Math.round((sum / sorted.length) * 10) / 10,
    medianDays: median(sorted),
    minDays: sorted[0] ?? 0,
    maxDays: sorted[sorted.length - 1] ?? 0,
    sampleSize: sorted.length,
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeTimeAnalytics(
  applications: readonly ApplicationRecord[],
  period: DateRange,
): TimeAnalytics {
  const now = new Date();

  // Applications that reached HR
  const hrDays = applications
    .filter((a) => ['hr_interview', 'technical_interview', 'final_interview', 'offer'].includes(a.status) && a.appliedAt)
    .map((a) => daysBetween(a.appliedAt!, now));

  // Applications that reached Technical
  const technicalDays = applications
    .filter((a) => ['technical_interview', 'final_interview', 'offer'].includes(a.status) && a.appliedAt)
    .map((a) => daysBetween(a.appliedAt!, now));

  // Applications that reached Final
  const finalDays = applications
    .filter((a) => ['final_interview', 'offer'].includes(a.status) && a.appliedAt)
    .map((a) => daysBetween(a.appliedAt!, now));

  // Applications that reached Offer
  const offerDays = applications
    .filter((a) => a.status === 'offer' && a.appliedAt)
    .map((a) => daysBetween(a.appliedAt!, now));

  // Total hiring duration (created to offer)
  const hiringDurations = applications
    .filter((a) => a.status === 'offer')
    .map((a) => daysBetween(a.createdAt, now));

  return {
    toHR: computeTimeMetric('To HR Interview', hrDays),
    toTechnical: computeTimeMetric('To Technical Interview', technicalDays),
    toFinal: computeTimeMetric('To Final Interview', finalDays),
    toOffer: computeTimeMetric('To Offer', offerDays),
    totalHiringDuration: computeTimeMetric('Total Hiring Duration', hiringDurations),
    fastestProcess: offerDays.length > 0
      ? { ...computeTimeMetric('Fastest', [Math.min(...offerDays)]), label: 'Fastest Process' }
      : computeTimeMetric('Fastest Process', []),
    longestProcess: offerDays.length > 0
      ? { ...computeTimeMetric('Longest', [Math.max(...offerDays)]), label: 'Longest Process' }
      : computeTimeMetric('Longest Process', []),
    period,
  };
}

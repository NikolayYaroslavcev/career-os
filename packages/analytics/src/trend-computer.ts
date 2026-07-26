import type { Trends, TrendMetric, TrendPoint, DateRange } from './types.js';
import { mean } from './stats-utils.js';

interface ApplicationRecord {
  readonly status: string;
  readonly createdAt: Date;
}

interface MatchResultRecord {
  readonly generatedAt: Date;
  readonly overallScore: number;
}

const MAX_BUCKETS = 60;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface Bucket {
  readonly date: string;
  readonly from: Date;
  readonly to: Date;
}

function buildBuckets(range: DateRange): readonly Bucket[] {
  const totalDays = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / MS_PER_DAY));
  const bucketDays = Math.max(1, Math.ceil(totalDays / MAX_BUCKETS));
  const buckets: Bucket[] = [];

  let cursor = new Date(range.from);
  while (cursor < range.to) {
    const from = new Date(cursor);
    const to = new Date(Math.min(cursor.getTime() + bucketDays * MS_PER_DAY, range.to.getTime()));
    buckets.push({ date: from.toISOString().slice(0, 10), from, to });
    cursor = to;
  }

  return buckets;
}

function direction(delta: number): TrendMetric['direction'] {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'stable';
}

function buildMetric(
  name: string,
  current: number,
  previous: number,
  dataPoints: readonly TrendPoint[],
): TrendMetric {
  const delta = Math.round((current - previous) * 100) / 100;
  const deltaPercentage = previous !== 0
    ? Math.round((delta / previous) * 10000) / 100
    : current > 0 ? 100 : 0;

  return {
    name,
    current: Math.round(current * 100) / 100,
    previous: Math.round(previous * 100) / 100,
    delta,
    deltaPercentage,
    direction: direction(delta),
    dataPoints,
  };
}

const INTERVIEW_STATUSES = new Set(['hr_interview', 'technical_interview', 'final_interview']);
const RESPONDED_STATUSES_EXCLUDED = new Set(['saved', 'applied']);

function responseRate(apps: readonly ApplicationRecord[]): number {
  if (apps.length === 0) return 0;
  const responded = apps.filter((a) => !RESPONDED_STATUSES_EXCLUDED.has(a.status)).length;
  return Math.round((responded / apps.length) * 10000) / 100;
}

/**
 * Computes period-over-previous-period trend metrics with a daily (or
 * coarser, capped at MAX_BUCKETS) time series for each — applications,
 * interviews, offers, response rate, and average match score.
 */
export function computeTrends(
  currentApplications: readonly ApplicationRecord[],
  previousApplications: readonly ApplicationRecord[],
  currentMatches: readonly MatchResultRecord[],
  previousMatches: readonly MatchResultRecord[],
  currentRange: DateRange,
): Trends {
  const buckets = buildBuckets(currentRange);

  const inBucket = (date: Date, bucket: Bucket): boolean => date >= bucket.from && date < bucket.to;

  const applicationsPoints: TrendPoint[] = buckets.map((b) => ({
    date: b.date,
    value: currentApplications.filter((a) => inBucket(a.createdAt, b)).length,
  }));

  const interviewsPoints: TrendPoint[] = buckets.map((b) => ({
    date: b.date,
    value: currentApplications.filter((a) => INTERVIEW_STATUSES.has(a.status) && inBucket(a.createdAt, b)).length,
  }));

  const offersPoints: TrendPoint[] = buckets.map((b) => ({
    date: b.date,
    value: currentApplications.filter((a) => a.status === 'offer' && inBucket(a.createdAt, b)).length,
  }));

  const responseRatePoints: TrendPoint[] = buckets.map((b) => ({
    date: b.date,
    value: responseRate(currentApplications.filter((a) => inBucket(a.createdAt, b))),
  }));

  const matchScorePoints: TrendPoint[] = buckets.map((b) => {
    const bucketMatches = currentMatches.filter((m) => inBucket(m.generatedAt, b));
    return { date: b.date, value: Math.round(mean(bucketMatches.map((m) => m.overallScore))) };
  });

  const totalOffers = (apps: readonly ApplicationRecord[]): number => apps.filter((a) => a.status === 'offer').length;
  const totalInterviews = (apps: readonly ApplicationRecord[]): number =>
    apps.filter((a) => INTERVIEW_STATUSES.has(a.status)).length;

  const metrics: TrendMetric[] = [
    buildMetric('Applications', currentApplications.length, previousApplications.length, applicationsPoints),
    buildMetric('Interviews', totalInterviews(currentApplications), totalInterviews(previousApplications), interviewsPoints),
    buildMetric('Offers', totalOffers(currentApplications), totalOffers(previousApplications), offersPoints),
    buildMetric('Response Rate', responseRate(currentApplications), responseRate(previousApplications), responseRatePoints),
    buildMetric(
      'Avg Match Score',
      mean(currentMatches.map((m) => m.overallScore)),
      mean(previousMatches.map((m) => m.overallScore)),
      matchScorePoints,
    ),
  ];

  return { metrics, period: currentRange };
}

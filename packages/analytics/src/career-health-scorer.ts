import type { CareerHealthScore, HealthComponent, DateRange } from './types.js';

interface HealthInputs {
  readonly totalApplications: number;
  readonly applicationsThisWeek: number;
  readonly totalInterviews: number;
  readonly totalOffers: number;
  readonly totalRejected: number;
  readonly avgMatchScore: number;
  readonly recentActivityTrend: number; // positive = increasing, negative = decreasing
}

const COMPONENT_WEIGHTS = {
  activityLevel: 0.2,
  interviewRate: 0.25,
  offerRate: 0.2,
  matchQuality: 0.2,
  consistency: 0.15,
} as const;

function computeActivityLevel(applicationsThisWeek: number, totalApplications: number): number {
  // Expect at least 3 applications per week for healthy activity
  if (applicationsThisWeek >= 5) return 100;
  if (applicationsThisWeek >= 3) return 80;
  if (applicationsThisWeek >= 1) return 50;
  if (totalApplications > 0) return 20;
  return 0;
}

function computeInterviewRate(totalInterviews: number, totalApplications: number): number {
  if (totalApplications === 0) return 0;
  const rate = totalInterviews / totalApplications;
  // 30%+ interview rate is excellent
  if (rate >= 0.3) return 100;
  if (rate >= 0.2) return 80;
  if (rate >= 0.1) return 60;
  if (rate >= 0.05) return 40;
  return 20;
}

function computeOfferRate(totalOffers: number, totalApplications: number): number {
  if (totalApplications === 0) return 0;
  const rate = totalOffers / totalApplications;
  // 10%+ offer rate is excellent
  if (rate >= 0.1) return 100;
  if (rate >= 0.05) return 80;
  if (rate >= 0.02) return 60;
  if (rate >= 0.01) return 40;
  return 20;
}

function computeMatchQuality(avgMatchScore: number): number {
  // Higher match scores indicate better targeting
  if (avgMatchScore >= 80) return 100;
  if (avgMatchScore >= 70) return 80;
  if (avgMatchScore >= 60) return 60;
  if (avgMatchScore >= 50) return 40;
  return 20;
}

function computeConsistency(applicationsThisWeek: number, totalApplications: number): number {
  // Consistency based on regular activity
  if (totalApplications === 0) return 0;
  const weeklyAvg = totalApplications / 4; // rough estimate
  const ratio = applicationsThisWeek / Math.max(weeklyAvg, 1);
  if (ratio >= 0.8 && ratio <= 1.5) return 100;
  if (ratio >= 0.5 && ratio <= 2.0) return 80;
  if (ratio >= 0.3) return 60;
  return 40;
}

export function computeCareerHealthScore(
  inputs: HealthInputs,
  period: DateRange,
): CareerHealthScore {
  const components: HealthComponent[] = [
    {
      name: 'Activity Level',
      score: computeActivityLevel(inputs.applicationsThisWeek, inputs.totalApplications),
      weight: COMPONENT_WEIGHTS.activityLevel,
      description: 'Based on weekly application volume',
    },
    {
      name: 'Interview Rate',
      score: computeInterviewRate(inputs.totalInterviews, inputs.totalApplications),
      weight: COMPONENT_WEIGHTS.interviewRate,
      description: 'Percentage of applications leading to interviews',
    },
    {
      name: 'Offer Rate',
      score: computeOfferRate(inputs.totalOffers, inputs.totalApplications),
      weight: COMPONENT_WEIGHTS.offerRate,
      description: 'Percentage of applications leading to offers',
    },
    {
      name: 'Match Quality',
      score: computeMatchQuality(inputs.avgMatchScore),
      weight: COMPONENT_WEIGHTS.matchQuality,
      description: 'Average match score across applications',
    },
    {
      name: 'Consistency',
      score: computeConsistency(inputs.applicationsThisWeek, inputs.totalApplications),
      weight: COMPONENT_WEIGHTS.consistency,
      description: 'Regularity of application activity',
    },
  ];

  const overall = Math.round(
    components.reduce((sum, c) => sum + c.score * c.weight, 0),
  );

  const confidence: CareerHealthScore['confidence'] =
    inputs.totalApplications >= 20 ? 'high' :
    inputs.totalApplications >= 5 ? 'medium' : 'low';

  const trend: CareerHealthScore['trend'] =
    inputs.recentActivityTrend > 0.1 ? 'improving' :
    inputs.recentActivityTrend < -0.1 ? 'declining' : 'stable';

  const trendDelta = Math.round(inputs.recentActivityTrend * 100);

  return {
    overall,
    confidence,
    components,
    trend,
    trendDelta,
    period,
  };
}

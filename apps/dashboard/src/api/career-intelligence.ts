import { apiClient } from './client';

export type TrendPeriod = '7d' | '30d' | '90d' | '180d' | '365d' | 'all';

export interface DateRange {
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

export interface CareerMetrics {
  readonly applicationsSent: number;
  readonly applicationsSaved: number;
  readonly hrInterviews: number;
  readonly technicalInterviews: number;
  readonly finalInterviews: number;
  readonly offers: number;
  readonly acceptedOffers: number;
  readonly rejectedOffers: number;
  readonly withdrawnApplications: number;
  readonly expiredApplications: number;
  readonly currentActive: number;
  readonly avgMatchScore: number;
  readonly avgSalary: number | null;
  readonly avgResponseTime: number | null;
  readonly avgHiringTime: number | null;
  readonly period: DateRange;
}

export interface FunnelStage {
  readonly name: string;
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
  readonly dropOff: number;
  readonly dropOffPercentage: number;
}

export interface ApplicationFunnel {
  readonly stages: readonly FunnelStage[];
  readonly totalFound: number;
  readonly totalApplied: number;
  readonly totalOffers: number;
  readonly overallConversion: number;
  readonly period: DateRange;
}

export interface FailureStage {
  readonly stage: string;
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
  readonly avgDaysInStage: number;
}

export interface FailureAnalysis {
  readonly totalRejected: number;
  readonly totalWithdrawn: number;
  readonly totalExpired: number;
  readonly stages: readonly FailureStage[];
  readonly primaryFailurePoint: string;
  readonly period: DateRange;
}

export interface TimeMetric {
  readonly label: string;
  readonly avgDays: number;
  readonly medianDays: number;
  readonly minDays: number;
  readonly maxDays: number;
  readonly sampleSize: number;
}

export interface TimeAnalytics {
  readonly toHR: TimeMetric;
  readonly toTechnical: TimeMetric;
  readonly toFinal: TimeMetric;
  readonly toOffer: TimeMetric;
  readonly totalHiringDuration: TimeMetric;
  readonly fastestProcess: TimeMetric;
  readonly longestProcess: TimeMetric;
  readonly period: DateRange;
}

export interface MatchCategoryAnalytics {
  readonly category: string;
  readonly label: string;
  readonly avgScore: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly distribution: readonly { readonly range: string; readonly count: number }[];
}

export interface MatchAnalytics {
  readonly avgOverallScore: number;
  readonly medianOverallScore: number;
  readonly categoryAverages: readonly MatchCategoryAnalytics[];
  readonly lowestCategories: readonly { readonly category: string; readonly avgScore: number }[];
  readonly highestCategories: readonly { readonly category: string; readonly avgScore: number }[];
  readonly scoreDistribution: readonly { readonly range: string; readonly count: number }[];
  readonly correlationWithInterviewRate: number;
  readonly period: DateRange;
}

export interface HealthComponent {
  readonly name: string;
  readonly score: number;
  readonly weight: number;
  readonly description: string;
}

export interface CareerHealthScore {
  readonly overall: number;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly components: readonly HealthComponent[];
  readonly trend: 'improving' | 'stable' | 'declining';
  readonly trendDelta: number;
  readonly period: DateRange;
}

export interface BreakdownSegment {
  readonly label: string;
  readonly count: number;
  readonly applications: number;
  readonly interviews: number;
  readonly offers: number;
  readonly responseRate: number;
  readonly interviewRate: number;
  readonly offerRate: number;
  readonly avgMatchScore: number;
}

export interface PerformanceBreakdown {
  readonly dimension: string;
  readonly segments: readonly BreakdownSegment[];
  readonly period: DateRange;
}

export interface SuccessPattern {
  readonly dimension: string;
  readonly bestPerforming: string;
  readonly metric: string;
  readonly value: number;
  readonly comparison: number;
  readonly sampleSize: number;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly description: string;
}

export interface TrendPoint {
  readonly date: string;
  readonly value: number;
}

export interface TrendMetric {
  readonly name: string;
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
  readonly deltaPercentage: number;
  readonly direction: 'up' | 'down' | 'stable';
  readonly dataPoints: readonly TrendPoint[];
}

export interface Trends {
  readonly metrics: readonly TrendMetric[];
  readonly period: DateRange;
}

export interface Insight {
  readonly id: string;
  readonly type: 'positive' | 'negative' | 'neutral' | 'actionable';
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly metric: string;
  readonly value: number;
  readonly change: number;
  readonly priority: 'high' | 'medium' | 'low';
}

export interface Insights {
  readonly insights: readonly Insight[];
  readonly generatedAt: string;
  readonly period: DateRange;
}

function query(period?: TrendPeriod): string {
  return period ? `?period=${period}` : '';
}

export async function getOverview(period?: TrendPeriod): Promise<CareerMetrics> {
  return apiClient(`/api/v1/career-intelligence/overview${query(period)}`);
}

export async function getFunnel(period?: TrendPeriod): Promise<ApplicationFunnel> {
  return apiClient(`/api/v1/career-intelligence/funnel${query(period)}`);
}

export async function getFailureAnalysis(period?: TrendPeriod): Promise<FailureAnalysis> {
  return apiClient(`/api/v1/career-intelligence/failure-analysis${query(period)}`);
}

export async function getTimeAnalytics(period?: TrendPeriod): Promise<TimeAnalytics> {
  return apiClient(`/api/v1/career-intelligence/time-analytics${query(period)}`);
}

export async function getMatchAnalytics(period?: TrendPeriod): Promise<MatchAnalytics> {
  return apiClient(`/api/v1/career-intelligence/match-analytics${query(period)}`);
}

export async function getCareerHealth(period?: TrendPeriod): Promise<CareerHealthScore> {
  return apiClient(`/api/v1/career-intelligence/health${query(period)}`);
}

export async function getPerformanceBreakdowns(period?: TrendPeriod): Promise<{ breakdowns: PerformanceBreakdown[] }> {
  return apiClient(`/api/v1/career-intelligence/performance-breakdowns${query(period)}`);
}

export async function getSuccessPatterns(period?: TrendPeriod): Promise<{ patterns: SuccessPattern[] }> {
  return apiClient(`/api/v1/career-intelligence/success-patterns${query(period)}`);
}

export async function getTrends(period?: TrendPeriod): Promise<Trends> {
  return apiClient(`/api/v1/career-intelligence/trends${query(period)}`);
}

export async function getInsights(period?: TrendPeriod): Promise<Insights> {
  return apiClient(`/api/v1/career-intelligence/insights${query(period)}`);
}

export async function refreshInsights(period?: TrendPeriod): Promise<Insights> {
  return apiClient(`/api/v1/career-intelligence/refresh${query(period)}`, { method: 'POST' });
}

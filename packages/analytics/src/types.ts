// ==================== Application Funnel ====================

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

// ==================== Performance Breakdown ====================

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

// ==================== Success Patterns ====================

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

// ==================== Failure Analysis ====================

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

// ==================== Time Analytics ====================

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

// ==================== Match Analytics ====================

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

// ==================== Career Health Score ====================

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

// ==================== Trends ====================

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

// ==================== Insights ====================

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
  readonly generatedAt: Date;
  readonly period: DateRange;
}

// ==================== Career Metrics Overview ====================

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

// ==================== Resume Version Performance ====================

export interface ResumeVersionPerformance {
  readonly resumeId: string;
  readonly applications: number;
  readonly saved: number;
  readonly applied: number;
  readonly hrInterviews: number;
  readonly technicalInterviews: number;
  readonly finalInterviews: number;
  readonly offers: number;
  /** ApplicationStatus has no ACCEPTED sub-state today — mirrors CareerMetrics.acceptedOffers, always 0. */
  readonly accepted: number;
  readonly rejected: number;
  /** ApplicationStatus.ARCHIVED count — same convention as CareerMetrics.withdrawnApplications. */
  readonly withdrawn: number;
  readonly interviewRate: number;
  readonly offerRate: number;
  readonly responseRate: number;
  readonly avgMatchScore: number;
  readonly avgSalary: number | null;
  readonly avgSalaryCurrency: string | null;
  readonly avgResponseTime: number | null;
  readonly avgHiringTime: number | null;
  readonly period: DateRange;
}

// ==================== Resume Version Comparison (A/B) ====================

export interface ResumeVersionSummary {
  readonly resumeId: string;
  readonly applications: number;
  readonly interviewRate: number;
  readonly offerRate: number;
  readonly responseRate: number;
  readonly avgMatchScore: number;
  readonly avgSalary: number | null;
  readonly sampleSize: number;
}

export type ResumeComparisonMetric = 'interviewRate' | 'offerRate' | 'responseRate' | 'avgMatchScore';

export interface ResumeVersionMetricDelta {
  readonly metric: ResumeComparisonMetric;
  readonly deltaAbsolute: number;
  readonly deltaPercentage: number;
  readonly winner: 'A' | 'B' | 'tie';
}

export interface ResumeVersionComparison {
  readonly versionA: ResumeVersionSummary;
  readonly versionB: ResumeVersionSummary;
  readonly metricDeltas: readonly ResumeVersionMetricDelta[];
  readonly overallWinner: 'A' | 'B' | 'tie';
  readonly confidence: 'high' | 'medium' | 'low';
  readonly period: DateRange;
}

// ==================== Resume Version Recommendation ====================

export interface ResumeRecommendationReason {
  readonly factor: string;
  readonly resumeVersionValue: number;
  readonly comparisonValue: number;
  readonly weight: number;
}

export interface ResumeRecommendationCandidate {
  readonly resumeId: string;
  readonly score: number;
}

export interface ResumeRecommendation {
  readonly vacancyId: string;
  readonly recommendedResumeId: string | null;
  readonly score: number;
  readonly reasons: readonly ResumeRecommendationReason[];
  readonly alternatives: readonly ResumeRecommendationCandidate[];
  readonly confidence: 'high' | 'medium' | 'low';
}

// ==================== Common Types ====================

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
  readonly label: string;
}

export type TrendPeriod = '7d' | '30d' | '90d' | '180d' | '365d' | 'all';

export function getDateRangeForPeriod(period: TrendPeriod, now: Date = new Date()): DateRange {
  const to = new Date(now);
  const from = new Date(now);

  switch (period) {
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '90d':
      from.setDate(from.getDate() - 90);
      break;
    case '180d':
      from.setDate(from.getDate() - 180);
      break;
    case '365d':
      from.setFullYear(from.getFullYear() - 1);
      break;
    case 'all':
      from.setFullYear(2020, 0, 1);
      break;
  }

  return { from, to, label: period };
}

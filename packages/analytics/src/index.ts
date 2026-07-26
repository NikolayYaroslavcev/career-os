// Career analytics
export type {
  FunnelStage,
  ApplicationFunnel,
  BreakdownSegment,
  PerformanceBreakdown,
  SuccessPattern,
  FailureStage,
  FailureAnalysis,
  TimeMetric,
  TimeAnalytics,
  MatchCategoryAnalytics,
  MatchAnalytics,
  HealthComponent,
  CareerHealthScore,
  TrendPoint,
  TrendMetric,
  Trends,
  Insight,
  Insights,
  CareerMetrics,
  DateRange,
  TrendPeriod,
  ResumeVersionPerformance,
  ResumeVersionSummary,
  ResumeComparisonMetric,
  ResumeVersionMetricDelta,
  ResumeVersionComparison,
  ResumeRecommendationReason,
  ResumeRecommendationCandidate,
  ResumeRecommendation,
} from './types.js';
export { getDateRangeForPeriod } from './types.js';

export { computeFunnel } from './funnel-computer.js';
export { analyzeFailures, computeRejectionBreakdown } from './failure-analyzer.js';
export { computeCareerHealthScore } from './career-health-scorer.js';
export {
  analyzeByCountry,
  analyzeByCity,
  analyzeByProvider,
  analyzeByRemotePreference,
  analyzeBySalaryRange,
  analyzeByExperienceLevel,
  analyzeByCompany,
  analyzeByIndustry,
  analyzeByCompanySize,
  analyzeByTechnology,
  analyzeByResumeVersion,
} from './response-rate-analyzer.js';
export type { ResumeApplicationRecord } from './response-rate-analyzer.js';
export { computeTimeAnalytics } from './time-analytics.js';
export { computeMatchAnalytics } from './match-analytics.js';
export { generateInsights, analyzeBreakdownForInsights, generateResumeVersionInsights } from './insight-generator.js';
export type { ResumeVersionDimensionalBreakdown } from './insight-generator.js';
export { analyzeSuccessPatterns, confidenceFor, MIN_SAMPLE_SIZE } from './success-pattern-analyzer.js';
export { computeTrends } from './trend-computer.js';
export { mean, median, pearsonCorrelation } from './stats-utils.js';
export { computeAverageSalary } from './salary-analytics.js';
export type { SalaryEntry, AverageSalaryResult } from './salary-analytics.js';
export { compareResumeVersions } from './resume-version-comparator.js';
export { recommendResumeVersion } from './resume-version-recommender.js';
export type { RecommendationVacancyInput, ResumeVersionCandidate } from './resume-version-recommender.js';

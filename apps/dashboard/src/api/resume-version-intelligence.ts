import { apiClient } from './client';
import type { TrendPeriod, DateRange, PerformanceBreakdown, Insights } from './career-intelligence';

export type ResumeVersionStatus = 'draft' | 'active' | 'archived';

export interface ResumeVersionDTO {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly language: string | null;
  readonly tags: readonly string[];
  readonly status: ResumeVersionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResumeVersionPerformance {
  readonly resumeId: string;
  readonly applications: number;
  readonly saved: number;
  readonly applied: number;
  readonly hrInterviews: number;
  readonly technicalInterviews: number;
  readonly finalInterviews: number;
  readonly offers: number;
  readonly accepted: number;
  readonly rejected: number;
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

export type ResumeComparisonMetric = 'interviewRate' | 'offerRate' | 'responseRate' | 'avgMatchScore';

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

export interface ResumeRecommendationReason {
  readonly factor: string;
  readonly resumeVersionValue: number;
  readonly comparisonValue: number;
  readonly weight: number;
}

export interface ResumeRecommendation {
  readonly vacancyId: string;
  readonly recommendedResumeId: string | null;
  readonly score: number;
  readonly reasons: readonly ResumeRecommendationReason[];
  readonly alternatives: readonly { readonly resumeId: string; readonly score: number }[];
  readonly confidence: 'high' | 'medium' | 'low';
}

export interface ResumeVersionPerformanceDetail {
  readonly performance: ResumeVersionPerformance;
  readonly breakdowns: readonly PerformanceBreakdown[];
  readonly insights: Insights;
}

function query(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined);
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

export async function listResumeVersions(params?: {
  status?: ResumeVersionStatus;
  tag?: string;
}): Promise<{ versions: ResumeVersionDTO[]; total: number }> {
  return apiClient(`/api/v1/career-intelligence/resume-versions${query({ status: params?.status, tag: params?.tag })}`);
}

export async function getAllResumeVersionsPerformance(period?: TrendPeriod): Promise<{ performance: ResumeVersionPerformance[] }> {
  return apiClient(`/api/v1/career-intelligence/resume-versions/performance${query({ period })}`);
}

export async function getResumeVersion(id: string): Promise<ResumeVersionDTO> {
  return apiClient(`/api/v1/career-intelligence/resume-versions/${id}`);
}

export async function getResumeVersionPerformance(id: string, period?: TrendPeriod): Promise<ResumeVersionPerformanceDetail> {
  return apiClient(`/api/v1/career-intelligence/resume-versions/${id}/performance${query({ period })}`);
}

export async function compareResumeVersions(
  resumeIdA: string,
  resumeIdB: string,
  period?: TrendPeriod,
): Promise<ResumeVersionComparison> {
  return apiClient(`/api/v1/career-intelligence/resume-compare${query({ resumeIdA, resumeIdB, period })}`);
}

export async function getResumeRecommendation(vacancyId: string): Promise<ResumeRecommendation> {
  return apiClient(`/api/v1/career-intelligence/resume-recommendation/${vacancyId}`);
}

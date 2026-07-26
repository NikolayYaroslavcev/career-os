import { randomUUID } from 'node:crypto';
import type { Insight, Insights, DateRange, PerformanceBreakdown } from './types.js';

function generateId(): string {
  return randomUUID().slice(0, 8);
}

export function analyzeBreakdownForInsights(
  breakdown: PerformanceBreakdown,
): Insight[] {
  const insights: Insight[] = [];
  const { segments, dimension } = breakdown;

  if (segments.length < 2) return insights;

  const sorted = [...segments].sort((a, b) => b.interviewRate - a.interviewRate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (best && worst && best.label !== worst.label) {
    if (best.interviewRate > worst.interviewRate * 2 && best.count >= 3) {
      insights.push({
        id: generateId(),
        type: 'positive',
        category: 'performance',
        title: `${best.label} performs best for ${dimension}`,
        description: `${best.label} has a ${best.interviewRate}% interview rate compared to ${worst.interviewRate}% for ${worst.label}.`,
        metric: 'interviewRate',
        value: best.interviewRate,
        change: best.interviewRate - worst.interviewRate,
        priority: 'medium',
      });
    }

    if (best.offerRate > 0 && worst.offerRate === 0 && best.count >= 2) {
      insights.push({
        id: generateId(),
        type: 'actionable',
        category: 'strategy',
        title: `Focus on ${best.label}`,
        description: `${best.label} has a ${best.offerRate}% offer rate while ${worst.label} has 0%. Consider prioritizing ${best.label} applications.`,
        metric: 'offerRate',
        value: best.offerRate,
        change: best.offerRate,
        priority: 'high',
      });
    }
  }

  return insights;
}

function analyzeResponseRateTrend(
  currentRate: number,
  previousRate: number,
): Insight | null {
  const delta = currentRate - previousRate;
  if (Math.abs(delta) < 5) return null;

  return {
    id: generateId(),
    type: delta > 0 ? 'positive' : 'negative',
    category: 'trend',
    title: delta > 0 ? 'Response rate improved' : 'Response rate declined',
    description: `Response rate ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(delta))}%.`,
    metric: 'responseRate',
    value: currentRate,
    change: delta,
    priority: Math.abs(delta) > 15 ? 'high' : 'medium',
  };
}

function analyzeMatchScoreCorrelation(
  highMatchInterviewRate: number,
  lowMatchInterviewRate: number,
): Insight | null {
  const delta = highMatchInterviewRate - lowMatchInterviewRate;
  if (Math.abs(delta) < 5) return null;

  return {
    id: generateId(),
    type: delta > 0 ? 'positive' : 'neutral',
    category: 'correlation',
    title: 'Match score correlates with interview success',
    description: `Applications with match scores above 70% have a ${highMatchInterviewRate}% interview rate vs ${lowMatchInterviewRate}% for scores below 50%.`,
    metric: 'correlation',
    value: delta,
    change: delta,
    priority: 'medium',
  };
}

export function generateInsights(
  breakdowns: readonly PerformanceBreakdown[],
  responseRate: number,
  previousResponseRate: number,
  highMatchInterviewRate: number,
  lowMatchInterviewRate: number,
  period: DateRange,
): Insights {
  const insights: Insight[] = [];

  // Analyze each breakdown
  for (const breakdown of breakdowns) {
    insights.push(...analyzeBreakdownForInsights(breakdown));
  }

  // Response rate trend
  const responseInsight = analyzeResponseRateTrend(responseRate, previousResponseRate);
  if (responseInsight) insights.push(responseInsight);

  // Match score correlation
  const correlationInsight = analyzeMatchScoreCorrelation(highMatchInterviewRate, lowMatchInterviewRate);
  if (correlationInsight) insights.push(correlationInsight);

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    insights,
    generatedAt: new Date(),
    period,
  };
}

export interface ResumeVersionDimensionalBreakdown {
  readonly resumeId: string;
  readonly resumeLabel: string;
  readonly breakdowns: readonly PerformanceBreakdown[];
}

/**
 * Resume-version insights reuse the exact same best-vs-worst-segment analysis as
 * generateInsights — the only new logic is composing per-version dimensional
 * breakdowns (country/provider/technology/etc., pre-filtered to one resume's
 * applications) into a single insight list with the resume's label substituted
 * in place of its id. No new insight-text templates are introduced.
 */
export function generateResumeVersionInsights(
  overallBreakdown: PerformanceBreakdown,
  perVersionDimensionalBreakdowns: readonly ResumeVersionDimensionalBreakdown[],
  period: DateRange,
): Insights {
  const insights: Insight[] = [...analyzeBreakdownForInsights(overallBreakdown)];

  for (const { resumeLabel, breakdowns } of perVersionDimensionalBreakdowns) {
    for (const breakdown of breakdowns) {
      for (const insight of analyzeBreakdownForInsights(breakdown)) {
        insights.push({
          ...insight,
          id: generateId(),
          description: `${resumeLabel}: ${insight.description}`,
        });
      }
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    insights,
    generatedAt: new Date(),
    period,
  };
}

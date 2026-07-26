import type { ApplicationFunnel, FunnelStage, DateRange } from './types.js';

interface ApplicationRecord {
  readonly status: string;
  readonly createdAt: Date;
  readonly appliedAt: Date | null;
}

const FUNNEL_STAGES = [
  { name: 'Found', status: 'all', order: 0 },
  { name: 'Saved', status: 'saved', order: 1 },
  { name: 'Applied', status: 'applied', order: 2 },
  { name: 'Waiting', status: 'waiting', order: 3 },
  { name: 'HR Interview', status: 'hr_interview', order: 4 },
  { name: 'Technical Interview', status: 'technical_interview', order: 5 },
  { name: 'Final Interview', status: 'final_interview', order: 6 },
  { name: 'Offer', status: 'offer', order: 7 },
] as const;

export function computeFunnel(
  applications: readonly ApplicationRecord[],
  vacanciesFound: number,
  period: DateRange,
): ApplicationFunnel {
  const totalFound = vacanciesFound;
  const totalApplied = applications.filter((a) =>
    ['applied', 'waiting', 'hr_interview', 'technical_interview', 'final_interview', 'offer'].includes(a.status),
  ).length;
  const totalOffers = applications.filter((a) => a.status === 'offer').length;

  const counts = FUNNEL_STAGES.map((stage) =>
    stage.status === 'all' ? totalFound : applications.filter((a) => a.status === stage.status).length,
  );

  const stages: FunnelStage[] = FUNNEL_STAGES.map((stage, i) => {
    const count = counts[i] ?? 0;
    const prevCount = i > 0 ? (counts[i - 1] ?? 0) : count;
    const dropOff = i > 0 ? prevCount - count : 0;

    return {
      name: stage.name,
      status: stage.status,
      count,
      percentage: totalFound > 0 ? Math.round((count / totalFound) * 10000) / 100 : 0,
      dropOff,
      dropOffPercentage: prevCount > 0 ? Math.round((dropOff / prevCount) * 10000) / 100 : 0,
    };
  });

  const overallConversion = totalFound > 0
    ? Math.round((totalOffers / totalFound) * 10000) / 100
    : 0;

  return {
    stages,
    totalFound,
    totalApplied,
    totalOffers,
    overallConversion,
    period,
  };
}

'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryScore } from '@/api/match-explanation';

interface CategoryRadarChartProps {
  categoryScores: CategoryScore[];
}

export function CategoryRadarChart({ categoryScores }: CategoryRadarChartProps): React.JSX.Element | null {
  if (categoryScores.length === 0) return null;

  const data = categoryScores.map((cs) => ({
    subject: cs.label,
    value: cs.value,
    fullMark: 100,
  }));

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
          />
          <Radar
            name="Match Score"
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
          />
          <Tooltip
            formatter={(value: unknown) => [`${String(value)}%`, 'Score']}
            contentStyle={{ fontSize: 12 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

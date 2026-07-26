'use client';

import type { CategoryScore } from '@/api/match-explanation';

function getScoreColor(value: number): string {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 60) return 'bg-blue-500';
  if (value >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function getScoreTextColor(value: number): string {
  if (value >= 80) return 'text-emerald-700';
  if (value >= 60) return 'text-blue-700';
  if (value >= 40) return 'text-amber-700';
  return 'text-red-700';
}

export function ScoreBar({ score }: { score: CategoryScore }): React.JSX.Element {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{score.label}</span>
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${getScoreTextColor(score.value)}`}>
            {score.value}%
          </span>
          <span className="text-xs text-gray-400">
            (w: {(score.weight * 100).toFixed(0)}%)
          </span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getScoreColor(score.value)}`}
          style={{ width: `${score.value}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">{score.explanation}</p>
    </div>
  );
}

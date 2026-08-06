'use client';

import type { ActionableItem } from '@/api/match-explanation';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Zap, TrendingUp, Target } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';

const TYPE_ICONS = {
  add_skill: Target,
  mention_keyword: Lightbulb,
  gain_experience: TrendingUp,
  adjust_expectation: Zap,
} as const;

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-800',
} as const;

const PRIORITY_KEY = {
  high: 'matchExplanationPage.priorityHigh',
  medium: 'matchExplanationPage.priorityMedium',
  low: 'matchExplanationPage.priorityLow',
} as const;

export function ActionableItems({ items }: { items: ActionableItem[] }): React.JSX.Element | null {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">{t('matchExplanationPage.recommendedActions')}</h3>
      <div className="space-y-2">
        {items.map((item, i) => {
          const Icon = TYPE_ICONS[item.type] ?? Lightbulb;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="mt-0.5 flex-shrink-0">
                <Icon className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <Badge className={PRIORITY_COLORS[item.priority]} variant="secondary">
                    {t(PRIORITY_KEY[item.priority])}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  {t('matchExplanationPage.potentialImprovement', { percent: item.impact })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

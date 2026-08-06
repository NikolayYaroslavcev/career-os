'use client';

import type { ExplanationItem } from '@/api/match-explanation';
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';

interface StrengthsWeaknessesProps {
  strengths: ExplanationItem[];
  weaknesses: ExplanationItem[];
}

export function StrengthsWeaknesses({ strengths, weaknesses }: StrengthsWeaknessesProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {t('matchExplanationPage.strengths')}
        </h3>
        <ul className="space-y-2">
          {strengths.map((s, i) => (
            <li key={i} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">{s.label}</p>
              <p className="text-xs text-emerald-600 mt-1">{s.detail}</p>
            </li>
          ))}
          {strengths.length === 0 && (
            <p className="text-sm text-gray-400 italic">{t('matchExplanationPage.noStrengths')}</p>
          )}
        </ul>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          {t('matchExplanationPage.weaknesses')}
        </h3>
        <ul className="space-y-2">
          {weaknesses.map((w, i) => (
            <li key={i} className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">{w.label}</p>
              <p className="text-xs text-red-600 mt-1">{w.detail}</p>
            </li>
          ))}
          {weaknesses.length === 0 && (
            <p className="text-sm text-gray-400 italic">{t('matchExplanationPage.noWeaknesses')}</p>
          )}
        </ul>
      </div>
    </div>
  );
}

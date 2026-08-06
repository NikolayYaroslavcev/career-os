'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/i18n-provider';

export function MissingKeywords({ keywords }: { keywords: string[] }): React.JSX.Element | null {
  const { t } = useTranslation();
  if (keywords.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">{t('matchExplanationPage.missingKeywordsTitle')}</h3>
      <p className="text-xs text-gray-500">
        {t('matchExplanationPage.missingKeywordsDesc')}
      </p>
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword, i) => (
          <Badge key={i} variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
            {keyword}
          </Badge>
        ))}
      </div>
    </div>
  );
}

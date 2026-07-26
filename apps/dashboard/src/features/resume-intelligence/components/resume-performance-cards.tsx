import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatNumber } from '@/lib/format';
import type { ResumeVersionPerformance } from '@/api/resume-version-intelligence';

interface ResumePerformanceCardsProps {
  readonly performance: ResumeVersionPerformance;
}

export function ResumePerformanceCards({ performance }: ResumePerformanceCardsProps): React.JSX.Element {
  const { t, locale } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('resumeIntelligencePage.applications')}</div>
          <div className="text-2xl font-semibold">{performance.applications}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('resumeIntelligencePage.interviewRate')}</div>
          <div className="text-2xl font-semibold">{performance.interviewRate}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('resumeIntelligencePage.offerRate')}</div>
          <div className="text-2xl font-semibold">{performance.offerRate}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('resumeIntelligencePage.responseRate')}</div>
          <div className="text-2xl font-semibold">{performance.responseRate}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('resumeIntelligencePage.avgMatchScore')}</div>
          <div className="text-2xl font-semibold">{performance.avgMatchScore}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('resumeIntelligencePage.avgSalary')}</div>
          <div className="text-2xl font-semibold">
            {performance.avgSalary !== null ? `${formatNumber(performance.avgSalary, locale)} ${performance.avgSalaryCurrency ?? ''}` : '—'}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('resumeIntelligencePage.avgResponseTime')}</div>
          <div className="text-2xl font-semibold">{performance.avgResponseTime !== null ? `${performance.avgResponseTime}d` : '—'}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('resumeIntelligencePage.avgHiringTime')}</div>
          <div className="text-2xl font-semibold">{performance.avgHiringTime !== null ? `${performance.avgHiringTime}d` : '—'}</div>
        </CardContent>
      </Card>
    </div>
  );
}

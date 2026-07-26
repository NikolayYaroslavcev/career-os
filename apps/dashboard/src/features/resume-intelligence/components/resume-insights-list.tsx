import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import type { Insights } from '@/api/career-intelligence';

interface ResumeInsightsListProps {
  readonly insights: Insights;
}

function priorityVariant(priority: string): 'destructive' | 'warning' | 'secondary' {
  if (priority === 'high') return 'destructive';
  if (priority === 'medium') return 'warning';
  return 'secondary';
}

export function ResumeInsightsList({ insights }: ResumeInsightsListProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resumeIntelligencePage.insightsTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('resumeIntelligencePage.noInsights')}</p>
        ) : (
          insights.insights.map((insight) => (
            <div key={insight.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="font-medium">{insight.title}</div>
                <div className="text-sm text-muted-foreground">{insight.description}</div>
              </div>
              <Badge variant={priorityVariant(insight.priority)}>
                {t(`resumeIntelligencePage.priority${insight.priority.charAt(0).toUpperCase()}${insight.priority.slice(1)}`)}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

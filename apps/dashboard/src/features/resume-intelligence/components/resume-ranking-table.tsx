import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import type { ResumeVersionDTO, ResumeVersionPerformance } from '@/api/resume-version-intelligence';

interface ResumeRankingTableProps {
  readonly versions: readonly ResumeVersionDTO[];
  readonly performance: readonly ResumeVersionPerformance[];
  readonly selectedResumeId: string | null;
  readonly onSelect: (resumeId: string) => void;
}

export function ResumeRankingTable({ versions, performance, selectedResumeId, onSelect }: ResumeRankingTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const performanceById = new Map(performance.map((p) => [p.resumeId, p]));

  const ranked = [...versions]
    .map((version) => ({ version, performance: performanceById.get(version.id) ?? null }))
    .sort((a, b) => (b.performance?.interviewRate ?? 0) - (a.performance?.interviewRate ?? 0));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('resumeIntelligencePage.version')}</TableHead>
          <TableHead>{t('resumeIntelligencePage.applications')}</TableHead>
          <TableHead>{t('resumeIntelligencePage.interviewRate')}</TableHead>
          <TableHead>{t('resumeIntelligencePage.offerRate')}</TableHead>
          <TableHead>{t('resumeIntelligencePage.responseRate')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ranked.map(({ version, performance: perf }, index) => (
          <TableRow
            key={version.id}
            onClick={() => onSelect(version.id)}
            className={`cursor-pointer ${version.id === selectedResumeId ? 'bg-muted' : ''}`}
          >
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {index === 0 && <Badge variant="success">{t('resumeIntelligencePage.top')}</Badge>}
                {index === ranked.length - 1 && ranked.length > 1 && (
                  <Badge variant="destructive">{t('resumeIntelligencePage.worst')}</Badge>
                )}
                {version.title}
              </div>
            </TableCell>
            <TableCell>{perf?.applications ?? 0}</TableCell>
            <TableCell>{perf?.interviewRate ?? 0}%</TableCell>
            <TableCell>{perf?.offerRate ?? 0}%</TableCell>
            <TableCell>{perf?.responseRate ?? 0}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

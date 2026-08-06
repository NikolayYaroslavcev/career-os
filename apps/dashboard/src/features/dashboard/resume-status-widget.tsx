'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { listResumes, type Resume } from '@/api/resumes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Upload } from 'lucide-react';

export function ResumeStatusWidget(): React.JSX.Element {
  const { t } = useTranslation();
  const [resume, setResume] = useState<Resume | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listResumes()
      .then(data => { if (data.resumes.length > 0) setResume(data.resumes[0] ?? null); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t('dashboardHome.sections.resumeStatus')}</CardTitle>
        <FileText className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {resume ? (
          <div>
            <p className="text-2xl font-bold text-foreground">{resume.title}</p>
            <p className="text-xs text-muted-foreground">{t('dashboardHome.resume.uploaded')}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {resume.technologies.slice(0, 5).map(tech => (
                <span key={tech} className="rounded-full bg-muted px-2 py-0.5 text-xs">{tech}</span>
              ))}
            </div>
            <Link href="/app/resumes">
              <Button variant="ghost" size="sm" className="mt-2 px-0">
                {t('dashboardHome.resume.viewAll')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('dashboardHome.resume.notUploaded')}</p>
            <Link href="/app/resumes">
              <Button size="sm" className="mt-2">
                <Upload className="mr-2 h-3 w-3" />
                {t('dashboardHome.resume.uploadCta')}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

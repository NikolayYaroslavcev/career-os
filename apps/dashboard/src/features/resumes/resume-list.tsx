'use client';

import { useState, useEffect } from 'react';
import { listResumes, deleteResume, type Resume } from '@/api/resumes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Trash2, Calendar } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';

interface ResumeListProps {
  refreshKey: number;
}

export function ResumeList({ refreshKey }: ResumeListProps): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchResumes(): Promise<void> {
      try {
        const data = await listResumes();
        if (cancelled) return;
        setResumes(data.resumes);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch resumes:', err);
        setError(t('resumes.loadFailed'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchResumes();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm(t('resumes.deleteConfirm'))) return;
    try {
      await deleteResume(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete resume:', err);
      setError(t('resumes.deleteFailed'));
    }
  };

  if (isLoading) {
    return <Loading text={t('resumes.loadingResumes')} />;
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto px-0"
              onClick={() => setError(null)}
            >
              {t('common.dismiss')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {resumes.length > 0 && (
        <div className="space-y-3">
          {resumes.map((resume) => (
            <Card key={resume.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{resume.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {resume.format.toUpperCase()}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(resume.createdAt).toLocaleDateString(locale)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(resume.id)}
                  aria-label={t('resumes.deleteAria')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSearchProfileSuggestion, type SearchProfileSuggestion } from '@/api/resumes';
import { createSearchProfile, type CreateSearchProfileInput } from '@/api/search-profiles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { SearchProfileForm, type SearchProfileFormInitialValues } from '@/features/search-profiles/search-profile-form';

interface ResumeSearchProfileSuggestionProps {
  resumeId: string;
  onCreated: () => void;
  onDismiss: () => void;
}

export function ResumeSearchProfileSuggestion({
  resumeId,
  onCreated,
  onDismiss,
}: ResumeSearchProfileSuggestionProps): React.JSX.Element | null {
  const router = useRouter();
  const { t } = useTranslation();
  const [suggestion, setSuggestion] = useState<SearchProfileSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestion(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getSearchProfileSuggestion(resumeId);
        if (!cancelled) setSuggestion(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('resumes.suggestionFailed'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchSuggestion();

    return (): void => {
      cancelled = true;
    };
  }, [resumeId, t]);

  const handleSubmit = async (data: CreateSearchProfileInput): Promise<void> => {
    setIsSaving(true);
    setError(null);
    try {
      await createSearchProfile(data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('searchProfiles.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
          <Loading size="sm" />
          {t('resumes.analyzingResume')}
        </CardContent>
      </Card>
    );
  }

  if (error && !suggestion) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/app/search-profiles')}>
            {t('resumes.createProfileManually')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!suggestion) return null;

  const initialValues: SearchProfileFormInitialValues = {
    name: suggestion.desiredPositions[0] ?? '',
    desiredPositions: suggestion.desiredPositions,
    desiredTechnologies: suggestion.technologies,
    experienceLevel: suggestion.experienceLevel,
    isRemoteOnly: suggestion.remotePreference === 'remote',
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex items-start gap-3 py-4 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">{t('resumes.suggestionTitle')}</p>
            <p className="text-muted-foreground">{t('resumes.suggestionSubtitle')}</p>
          </div>
        </CardContent>
      </Card>

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

      <SearchProfileForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={onDismiss}
        isLoading={isSaving}
        submitError={error}
      />

      <Button variant="outline" size="sm" onClick={() => router.push('/app/search-profiles')}>
        {t('resumes.createProfileManually')}
      </Button>
    </div>
  );
}

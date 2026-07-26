'use client';

import { useState } from 'react';
import { ResumeUpload } from './resume-upload';
import { ResumeList } from './resume-list';
import { ResumeSearchProfileSuggestion } from './resume-search-profile-suggestion';
import { useTranslation } from '@/lib/i18n/i18n-provider';

export function ResumePage(): React.JSX.Element {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [suggestingResumeId, setSuggestingResumeId] = useState<string | null>(null);

  const handleUploaded = (resumeId: string): void => {
    setRefreshKey((k) => k + 1);
    setSuggestingResumeId(resumeId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('resumes.pageTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('resumes.pageSubtitle')}</p>
      </div>

      <ResumeUpload onUploaded={handleUploaded} />

      {suggestingResumeId && (
        <ResumeSearchProfileSuggestion
          resumeId={suggestingResumeId}
          onCreated={() => setSuggestingResumeId(null)}
          onDismiss={() => setSuggestingResumeId(null)}
        />
      )}

      <ResumeList refreshKey={refreshKey} />
    </div>
  );
}

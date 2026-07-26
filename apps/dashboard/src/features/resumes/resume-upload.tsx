'use client';

import { useState, useRef } from 'react';
import { uploadResume } from '@/api/resumes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';

interface ResumeUploadProps {
  onUploaded: (resumeId: string) => void;
}

export function ResumeUpload({ onUploaded }: ResumeUploadProps): React.JSX.Element {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File): Promise<void> => {
    if (file.type !== 'application/pdf') {
      setError(t('resumes.onlyPdfSupported'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('resumes.fileTooLarge'));
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadResume(file);
      onUploaded(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resumes.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (): void => setDragOver(false);

  return (
    <Card>
      <CardContent
        className={`py-12 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : ''
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />

        {isUploading ? (
          <div className="space-y-3">
            <Loading size="lg" className="mx-auto" />
            <p className="text-sm text-muted-foreground">{t('resumes.uploading')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">{t('resumes.uploadTitle')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('resumes.uploadSubtitle')}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <FileText className="mr-2 h-4 w-4" />
              {t('resumes.choosePdf')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('resumes.pdfOnlyMax')}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Copy, Check, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { listResumes, type Resume } from '@/api/resumes';
import { listSearchProfiles } from '@/api/search-profiles';
import {
  analyzeVacancy,
  tailorResume,
  generateCoverLetter,
  getInterviewPrep,
  getAIJobs,
  type AnalyzeVacancyResult,
  type TailorResumeResultData,
  type CoverLetterResultData,
  type InterviewPrepResultData,
  type AIJob,
} from '@/api/ai';
import {
  analyzeVacancyForApplication,
  tailorResumeForApplication,
  generateCoverLetterForApplication,
  interviewPrepForApplication,
} from '@/api/applications';

interface AiActionsPanelProps {
  readonly vacancyId: string;
  readonly vacancyTitle: string;
  readonly applicationId?: string;
}

const INTERVIEW_TYPES = ['HR', 'TECHNICAL', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'CODING', 'CULTURAL', 'FINAL'] as const;

const FEATURE_LABEL_KEYS: Record<string, string> = {
  analyze_vacancy: 'aiPanel.features.analyzeVacancy',
  tailor_resume: 'aiPanel.features.tailorResume',
  cover_letter: 'aiPanel.features.coverLetter',
  interview_prep: 'aiPanel.features.interviewPrep',
};

function jobStatusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'destructive';
    case 'PENDING':
    case 'QUEUED':
    case 'PROCESSING':
      return 'warning';
    default:
      return 'secondary';
  }
}

export function AiActionsPanel({ vacancyId, vacancyTitle, applicationId }: AiActionsPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {t('aiPanel.title')} · {vacancyTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="analyze">
          <TabsList>
            <TabsTrigger value="analyze">{t('aiPanel.tabs.analyze')}</TabsTrigger>
            <TabsTrigger value="tailor">{t('aiPanel.tabs.tailor')}</TabsTrigger>
            <TabsTrigger value="cover-letter">{t('aiPanel.tabs.coverLetter')}</TabsTrigger>
            <TabsTrigger value="interview-prep">{t('aiPanel.tabs.interviewPrep')}</TabsTrigger>
            <TabsTrigger value="history">{t('aiPanel.tabs.history')}</TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="pt-4">
            <AnalyzeTab vacancyId={vacancyId} applicationId={applicationId} />
          </TabsContent>
          <TabsContent value="tailor" className="pt-4">
            <TailorResumeTab vacancyId={vacancyId} applicationId={applicationId} />
          </TabsContent>
          <TabsContent value="cover-letter" className="pt-4">
            <CoverLetterTab vacancyId={vacancyId} applicationId={applicationId} />
          </TabsContent>
          <TabsContent value="interview-prep" className="pt-4">
            <InterviewPrepTab vacancyId={vacancyId} applicationId={applicationId} />
          </TabsContent>
          <TabsContent value="history" className="pt-4">
            <HistoryTab vacancyId={vacancyId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function AnalyzeTab({ vacancyId, applicationId }: { vacancyId: string; applicationId?: string }): React.JSX.Element {
  const { t } = useTranslation();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(!applicationId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<AnalyzeVacancyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (applicationId) return;
    let cancelled = false;
    listSearchProfiles()
      .then((data) => {
        if (!cancelled) setActiveProfileId(data.searchProfiles.find((p) => p.isActive)?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setActiveProfileId(null);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [applicationId]);

  const handleAnalyze = async (): Promise<void> => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = applicationId
        ? await analyzeVacancyForApplication(applicationId)
        : await analyzeVacancy({ vacancyId, searchProfileId: activeProfileId as string });
      setResult(response.result ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiPanel.errors.generic'));
    } finally {
      setIsGenerating(false);
    }
  };

  if (isChecking) return <Loading />;

  if (!applicationId && !activeProfileId) {
    return <p className="text-sm text-muted-foreground">{t('aiPanel.analyze.noActiveProfile')}</p>;
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleAnalyze} disabled={isGenerating}>
        {isGenerating ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            {t('aiPanel.analyze.generating')}
          </>
        ) : (
          t('aiPanel.analyze.generateCta')
        )}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && <AnalyzeResultView result={result} />}
    </div>
  );
}

function AnalyzeResultView({ result }: { result: AnalyzeVacancyResult }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={result.overallScore >= 70 ? 'success' : result.overallScore >= 40 ? 'warning' : 'destructive'}>
          {t('aiPanel.analyze.overallScore', { score: result.overallScore })}
        </Badge>
        <Badge variant="secondary">{result.recommendation}</Badge>
      </div>
      <p className="text-sm">{result.summary}</p>
      {result.strengths.length > 0 && (
        <div>
          <p className="text-sm font-medium">{t('aiPanel.analyze.strengths')}</p>
          <ul className="mt-1 space-y-1">
            {result.strengths.map((s, i) => (
              <li key={i} className="text-sm text-muted-foreground">• {s}</li>
            ))}
          </ul>
        </div>
      )}
      {result.missingSkills.length > 0 && (
        <div>
          <p className="text-sm font-medium">{t('aiPanel.analyze.missingSkills')}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {result.missingSkills.map((skill) => (
              <Badge key={skill} variant="outline">{skill}</Badge>
            ))}
          </div>
        </div>
      )}
      {result.reasoning && <p className="text-sm text-muted-foreground">{result.reasoning}</p>}
    </div>
  );
}

function useResumes(): { resumes: Resume[]; isLoading: boolean } {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listResumes()
      .then((data) => {
        if (!cancelled) setResumes(data.resumes);
      })
      .catch(() => {
        if (!cancelled) setResumes([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  return { resumes, isLoading };
}

function ResumeSelect({
  resumes,
  value,
  onChange,
}: {
  resumes: Resume[];
  value: string | null;
  onChange: (value: string | null) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
    >
      <option value="">{t('aiPanel.chooseResume')}</option>
      {resumes.map((resume) => (
        <option key={resume.id} value={resume.id}>
          {resume.title || t('aiPanel.untitledResume')}
        </option>
      ))}
    </select>
  );
}

function TailorResumeTab({ vacancyId, applicationId }: { vacancyId: string; applicationId?: string }): React.JSX.Element {
  const { t } = useTranslation();
  const { resumes, isLoading } = useResumes();
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResumeResultData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (): Promise<void> => {
    if (!selectedResumeId) return;
    setIsGenerating(true);
    setError(null);
    try {
      const response = applicationId
        ? await tailorResumeForApplication(applicationId, selectedResumeId)
        : await tailorResume({ vacancyId, resumeId: selectedResumeId });
      setResult(response.result ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiPanel.errors.generic'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!result?.tailoredResume) return;
    await navigator.clipboard.writeText(result.tailoredResume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <ResumeSelect resumes={resumes} value={selectedResumeId} onChange={setSelectedResumeId} />
      <div className="flex gap-2">
        <Button onClick={handleGenerate} disabled={!selectedResumeId || isGenerating}>
          {isGenerating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {t('aiPanel.tailor.generating')}
            </>
          ) : result ? (
            t('aiPanel.tailor.regenerateCta')
          ) : (
            t('aiPanel.tailor.generateCta')
          )}
        </Button>
        {result && (
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? t('aiPanel.copied') : t('aiPanel.copy')}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && <TailorResumeResultView result={result} />}
    </div>
  );
}

function TailorResumeResultView({ result }: { result: TailorResumeResultData }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-3 rounded-lg max-h-64 overflow-y-auto">
        {result.tailoredResume}
      </pre>
      {result.emphasizedSkills.length > 0 && (
        <div>
          <p className="text-sm font-medium">{t('aiPanel.tailor.addedSkills')}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {result.emphasizedSkills.map((skill) => (
              <Badge key={skill} variant="success">{skill}</Badge>
            ))}
          </div>
        </div>
      )}
      {result.reorderedExperience.length > 0 && (
        <div>
          <p className="text-sm font-medium">{t('aiPanel.tailor.changedSections')}</p>
          <div className="mt-1 space-y-2">
            {result.reorderedExperience.map((exp, i) => (
              <div key={i} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{exp.position} · {exp.company}</span>
                  <Badge variant={exp.relevanceScore >= 70 ? 'default' : 'secondary'}>{exp.relevanceScore}%</Badge>
                </div>
                <p className="mt-1 text-muted-foreground line-clamp-2">{exp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.keywordOptimizations.length > 0 && (
        <div>
          <p className="text-sm font-medium">{t('aiPanel.tailor.recommendations')}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {result.keywordOptimizations.map((keyword) => (
              <Badge key={keyword}>{keyword}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CoverLetterTab({ vacancyId, applicationId }: { vacancyId: string; applicationId?: string }): React.JSX.Element {
  const { t } = useTranslation();
  const { resumes, isLoading } = useResumes();
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [result, setResult] = useState<CoverLetterResultData | null>(null);
  const [editedText, setEditedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (): Promise<void> => {
    if (!selectedResumeId) return;
    setIsGenerating(true);
    setError(null);
    try {
      const response = applicationId
        ? await generateCoverLetterForApplication(applicationId, selectedResumeId)
        : await generateCoverLetter({ vacancyId, resumeId: selectedResumeId });
      setResult(response.result ?? null);
      setEditedText(response.result?.coverLetter ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiPanel.errors.generic'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!editedText) return;
    await navigator.clipboard.writeText(editedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <ResumeSelect resumes={resumes} value={selectedResumeId} onChange={setSelectedResumeId} />
      <div className="flex gap-2">
        <Button onClick={handleGenerate} disabled={!selectedResumeId || isGenerating}>
          {isGenerating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {t('aiPanel.coverLetter.generating')}
            </>
          ) : result ? (
            t('aiPanel.coverLetter.regenerateCta')
          ) : (
            t('aiPanel.coverLetter.generateCta')
          )}
        </Button>
        {result && (
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? t('aiPanel.copied') : t('aiPanel.copy')}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{result.tone}</Badge>
          </div>
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
          {result.keyPoints.length > 0 && (
            <div>
              <p className="text-sm font-medium">{t('aiPanel.coverLetter.keyPoints')}</p>
              <ul className="mt-1 space-y-1">
                {result.keyPoints.map((point, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InterviewPrepTab({ vacancyId, applicationId }: { vacancyId: string; applicationId?: string }): React.JSX.Element {
  const { t } = useTranslation();
  const [interviewType, setInterviewType] = useState<(typeof INTERVIEW_TYPES)[number]>('TECHNICAL');
  const [result, setResult] = useState<InterviewPrepResultData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (): Promise<void> => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = applicationId
        ? await interviewPrepForApplication(applicationId, interviewType)
        : await getInterviewPrep({ vacancyId, interviewType });
      setResult(response.result ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiPanel.errors.generic'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <select
        value={interviewType}
        onChange={(e) => setInterviewType(e.target.value as (typeof INTERVIEW_TYPES)[number])}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      >
        {INTERVIEW_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <Button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            {t('aiPanel.interviewPrep.generating')}
          </>
        ) : (
          t('aiPanel.interviewPrep.generateCta')
        )}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && <InterviewPrepResultView result={result} />}
    </div>
  );
}

function InterviewPrepResultView({ result }: { result: InterviewPrepResultData }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {result.keyTopics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.keyTopics.map((topic) => (
            <Badge key={topic} variant="secondary">{topic}</Badge>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {result.questions.map((q, i) => (
          <div key={i} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{q.question}</span>
              <Badge variant={q.difficulty === 'hard' ? 'destructive' : q.difficulty === 'medium' ? 'warning' : 'secondary'}>
                {q.difficulty}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{q.expectedAnswer}</p>
          </div>
        ))}
      </div>
      {result.tips.length > 0 && (
        <div>
          <p className="text-sm font-medium">{t('aiPanel.interviewPrep.tips')}</p>
          <ul className="mt-1 space-y-1">
            {result.tips.map((tip, i) => (
              <li key={i} className="text-sm text-muted-foreground">• {tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ vacancyId }: { vacancyId: string }): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAIJobs({ vacancyId })
      .then((data) => {
        if (!cancelled) setJobs(data.jobs);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('aiPanel.errors.generic'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [vacancyId, t]);

  if (isLoading) return <Loading />;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (jobs.length === 0) return <p className="text-sm text-muted-foreground">{t('aiPanel.history.empty')}</p>;

  return (
    <ul className="space-y-2">
      {jobs.map((job) => (
        <li key={job.id} className="rounded-md border p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left text-sm"
            onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
          >
            <span className="font-medium">{t(FEATURE_LABEL_KEYS[job.feature] ?? job.feature)}</span>
            <div className="flex items-center gap-2">
              <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(job.createdAt).toLocaleString(locale)}
              </span>
            </div>
          </button>
          {expandedId === job.id && (
            <div className="mt-2 border-t pt-2">
              <HistoryResultView feature={job.feature} result={job.result} error={job.error} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function HistoryResultView({ feature, result, error }: { feature: string; result: unknown; error?: string | null }): React.JSX.Element {
  const { t } = useTranslation();
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!result) return <p className="text-sm text-muted-foreground">{t('aiPanel.history.noResult')}</p>;

  switch (feature) {
    case 'analyze_vacancy':
      return <AnalyzeResultView result={result as AnalyzeVacancyResult} />;
    case 'tailor_resume':
      return <TailorResumeResultView result={result as TailorResumeResultData} />;
    case 'interview_prep':
      return <InterviewPrepResultView result={result as InterviewPrepResultData} />;
    case 'cover_letter': {
      const coverLetter = result as CoverLetterResultData;
      return <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-3 rounded-lg max-h-64 overflow-y-auto">{coverLetter.coverLetter}</pre>;
    }
    default:
      return <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded-lg max-h-64 overflow-y-auto">{JSON.stringify(result, null, 2)}</pre>;
  }
}

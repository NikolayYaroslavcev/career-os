'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { listResumes } from '@/api/resumes';
import { listSearchProfiles } from '@/api/search-profiles';
import { getVacancyStats } from '@/api/sync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { isAdmin } from '@/lib/access/nav-visibility';

interface OnboardingState {
  hasResume: boolean;
  hasProfile: boolean;
  hasSyncedProviders: boolean;
  hasTelegram: boolean;
  hasRecommendations: boolean;
  isLoading: boolean;
}

interface OnboardingStep {
  key: string;
  done: boolean;
  label: string;
  description: string;
  href: string;
}

export function OnboardingChecklist(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const canSyncProviders = isAdmin(user);
  const [state, setState] = useState<OnboardingState>({
    hasResume: false,
    hasProfile: false,
    hasSyncedProviders: false,
    hasTelegram: false,
    hasRecommendations: false,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function checkState(): Promise<void> {
      try {
        const [resumeData, profileData, statsData] = await Promise.allSettled([
          listResumes(),
          listSearchProfiles(),
          getVacancyStats(),
        ]);

        if (!mounted) return;

        const hasResume = resumeData.status === 'fulfilled' && resumeData.value.resumes.length > 0;
        const hasProfile = profileData.status === 'fulfilled' && profileData.value.searchProfiles.length > 0;
        const hasSyncedProviders = statsData.status === 'fulfilled' && statsData.value.totalJobs > 0;

        setState({
          hasResume,
          hasProfile,
          hasSyncedProviders,
          hasTelegram: false,
          hasRecommendations: hasProfile,
          isLoading: false,
        });
      } catch {
        if (mounted) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    }

    void checkState();
    return () => { mounted = false; };
  }, []);

  if (state.isLoading) return null;

  // Job-source syncing is an admin-only page (see app-shell's nav visibility)
  // — a regular user can't act on that step, so it's excluded from both the
  // checklist and the completion check below instead of linking them to a
  // page that immediately denies access.
  const allDone = state.hasResume && state.hasProfile && (!canSyncProviders || state.hasSyncedProviders);
  if (allDone) return null;

  const steps: OnboardingStep[] = [
    {
      key: 'resume',
      done: state.hasResume,
      label: t('dashboardHome.onboarding.uploadResume'),
      description: t('dashboardHome.onboarding.uploadResumeDesc'),
      href: '/app/resumes',
    },
    {
      key: 'profile',
      done: state.hasProfile,
      label: t('dashboardHome.onboarding.createProfile'),
      description: t('dashboardHome.onboarding.createProfileDesc'),
      href: '/app/search-profiles',
    },
    ...(canSyncProviders
      ? [
          {
            key: 'sync',
            done: state.hasSyncedProviders,
            label: t('dashboardHome.onboarding.syncProviders'),
            description: t('dashboardHome.onboarding.syncProvidersDesc'),
            href: '/app/sync',
          },
        ]
      : []),
    {
      key: 'telegram',
      done: state.hasTelegram,
      label: t('dashboardHome.onboarding.connectTelegram'),
      description: t('dashboardHome.onboarding.connectTelegramDesc'),
      href: '/app/telegram',
    },
    {
      key: 'recommendations',
      done: state.hasRecommendations,
      label: t('dashboardHome.onboarding.viewRecommendations'),
      description: t('dashboardHome.onboarding.viewRecommendationsDesc'),
      href: '/app/recommendations',
    },
  ];

  const completedCount = steps.filter(s => s.done).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('dashboardHome.onboarding.title')}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {completedCount}/{steps.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('dashboardHome.onboarding.subtitle')}
        </p>
        <div className="space-y-3">
          {steps.map((step) => {
            return (
              <div
                key={step.key}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
                {!step.done && (
                  <Link href={step.href}>
                    <Button variant="outline" size="sm">
                      {t('dashboardHome.onboarding.go')}
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

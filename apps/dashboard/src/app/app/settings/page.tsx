'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/api/client';
import type { UserRole } from '@/api/auth';
import { useTimedFlag } from '@/hooks/use-timed-flag';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export default function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, markSaved] = useTimedFlag(3000);

  useEffect(() => {
    let cancelled = false;
    apiClient<UserProfile>('/api/v1/users/me')
      .then(data => {
        if (cancelled) return;
        setProfile(data);
        setFirstName(data.firstName ?? '');
        setLastName(data.lastName ?? '');
      })
      .catch(() => { if (!cancelled) setError(t('settingsPage.loadFailed')); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      await apiClient('/api/v1/users/me', {
        method: 'PUT',
        body: { firstName: firstName.trim(), lastName: lastName.trim() },
      });
      markSaved();
    } catch {
      setError(t('settingsPage.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settingsPage.title')}</h1>
        <p className="text-muted-foreground">{t('settingsPage.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settingsPage.title')}</CardTitle>
          <CardDescription>{t('settingsPage.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('settingsPage.emailLabel')}</label>
              <Input
                value={user?.email ?? profile?.email ?? ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">{t('settingsPage.emailReadonly')}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('settingsPage.firstNameLabel')}</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('settingsPage.firstNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('settingsPage.lastNameLabel')}</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t('settingsPage.lastNamePlaceholder')}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {saved && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <AlertDescription>{t('settingsPage.saved')}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isSaving || !firstName.trim() || !lastName.trim()}>
              {isSaving ? t('settingsPage.saving') : t('settingsPage.save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import {
  listSearchProfiles,
  createSearchProfile,
  updateSearchProfile,
  enableSearchProfile,
  disableSearchProfile,
  deleteSearchProfile,
  type SearchProfile,
  type CreateSearchProfileInput,
} from '@/api/search-profiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/empty-state';
import { SearchProfileForm } from './search-profile-form';
import { Plus, Trash2, Search } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';

export function SearchProfileList(): React.JSX.Element {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SearchProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = async (): Promise<void> => {
    try {
      const data = await listSearchProfiles();
      setProfiles(data.searchProfiles);
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
      setError(t('searchProfiles.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleSubmit = async (data: CreateSearchProfileInput): Promise<void> => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingProfile) {
        await updateSearchProfile(editingProfile.id, data);
      } else {
        await createSearchProfile(data);
      }
      setShowForm(false);
      setEditingProfile(null);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError(err instanceof Error ? err.message : t('searchProfiles.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (profile: SearchProfile): Promise<void> => {
    try {
      if (profile.isActive) {
        await disableSearchProfile(profile.id);
      } else {
        await enableSearchProfile(profile.id);
      }
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to toggle profile:', err);
      setError(t('searchProfiles.toggleFailed'));
    }
  };

  const handleDelete = async (profile: SearchProfile): Promise<void> => {
    if (!confirm(t('searchProfiles.deleteConfirm'))) return;
    try {
      await deleteSearchProfile(profile.id);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to delete profile:', err);
      setError(t('searchProfiles.deleteFailed'));
    }
  };

  if (showForm || editingProfile) {
    return (
      <SearchProfileForm
        profile={editingProfile ?? undefined}
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowForm(false);
          setEditingProfile(null);
          setError(null);
        }}
        isLoading={isSubmitting}
        submitError={error}
      />
    );
  }

  if (isLoading) {
    return <Loading text={t('searchProfiles.loadingProfiles')} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('searchProfiles.title')}</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('searchProfiles.newProfile')}
        </Button>
      </div>

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

      {profiles.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t('searchProfiles.emptyTitle')}
          description={t('searchProfiles.emptyDesc')}
          action={{ label: t('searchProfiles.emptyCta'), onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{profile.name}</h3>
                    <Badge variant={profile.isActive ? 'success' : 'secondary'}>
                      {profile.isActive ? t('searchProfiles.active') : t('searchProfiles.inactive')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(`searchProfiles.experienceLevels.${profile.experienceLevel}`)} &middot;{' '}
                    {profile.desiredPositions.join(', ')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {profile.desiredTechnologies.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProfile(profile)}
                  >
                    {t('searchProfiles.edit')}
                  </Button>
                  <Button
                    variant={profile.isActive ? 'secondary' : 'default'}
                    size="sm"
                    onClick={() => handleToggleActive(profile)}
                  >
                    {profile.isActive ? t('searchProfiles.disable') : t('searchProfiles.enable')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(profile)}
                    aria-label={t('searchProfiles.deleteAria')}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

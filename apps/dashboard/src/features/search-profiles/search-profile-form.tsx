'use client';

import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SearchProfile, CreateSearchProfileInput } from '@/api/search-profiles';
import { useTranslation } from '@/lib/i18n/i18n-provider';

const PROFILE_SCHEMA_SHAPE = {
  name: z.string().min(1),
  desiredPositions: z.string().optional(),
  desiredTechnologies: z.string().optional(),
  experienceLevel: z.enum([
    'intern',
    'junior',
    'middle',
    'senior',
    'lead',
    'principal',
    'executive',
  ]),
  isRemoteOnly: z.boolean().default(false),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  salaryCurrency: z.enum(['USD', 'EUR', 'GBP', 'UAH', 'RUB']).default('USD'),
  locationCity: z.string().optional(),
  locationCountry: z.string().optional(),
  workMode: z.enum(['remote', 'hybrid', 'onsite']).default('remote'),
};

function createProfileSchema(t: (key: string) => string): z.ZodObject<typeof PROFILE_SCHEMA_SHAPE> {
  return z.object({
    ...PROFILE_SCHEMA_SHAPE,
    name: z.string().min(1, t('searchProfiles.nameRequired')),
  });
}

type ProfileFormValues = z.infer<z.ZodObject<typeof PROFILE_SCHEMA_SHAPE>>;

export interface SearchProfileFormInitialValues {
  name?: string;
  desiredPositions?: string[];
  desiredTechnologies?: string[];
  experienceLevel?: string;
  isRemoteOnly?: boolean;
}

interface SearchProfileFormProps {
  profile?: SearchProfile;
  initialValues?: SearchProfileFormInitialValues;
  onSubmit: (data: CreateSearchProfileInput) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  submitError?: string | null;
}

export function SearchProfileForm({
  profile,
  initialValues,
  onSubmit,
  onCancel,
  isLoading,
  submitError,
}: SearchProfileFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const profileSchema = useMemo(() => createProfileSchema(t), [t]);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name ?? initialValues?.name ?? '',
      desiredPositions:
        profile?.desiredPositions.join(', ') ?? initialValues?.desiredPositions?.join(', ') ?? '',
      desiredTechnologies:
        profile?.desiredTechnologies.join(', ') ?? initialValues?.desiredTechnologies?.join(', ') ?? '',
      experienceLevel:
        (profile?.experienceLevel as ProfileFormValues['experienceLevel']) ??
        (initialValues?.experienceLevel as ProfileFormValues['experienceLevel']) ??
        'middle',
      isRemoteOnly: profile?.isRemoteOnly ?? initialValues?.isRemoteOnly ?? false,
      salaryMin: profile?.desiredSalary?.min.toString() ?? '',
      salaryMax: profile?.desiredSalary?.max.toString() ?? '',
      salaryCurrency: (profile?.desiredSalary?.currency as ProfileFormValues['salaryCurrency']) ?? 'USD',
      locationCity: profile?.desiredLocations[0]?.city ?? '',
      locationCountry: profile?.desiredLocations[0]?.country ?? '',
      workMode:
        (profile?.desiredLocations[0]?.workMode as ProfileFormValues['workMode']) ??
        (initialValues?.isRemoteOnly ? 'remote' : undefined) ??
        'remote',
    },
  });

  const handleFormSubmit = async (data: ProfileFormValues): Promise<void> => {
    const desiredPositions = data.desiredPositions
      ? data.desiredPositions.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const desiredTechnologies = data.desiredTechnologies
      ? data.desiredTechnologies.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const input: CreateSearchProfileInput = {
      name: data.name.trim(),
      desiredPositions,
      desiredTechnologies,
      experienceLevel: data.experienceLevel,
      isRemoteOnly: data.isRemoteOnly,
      desiredLocations: [
        {
          workMode: data.workMode,
          city: data.locationCity || undefined,
          country: data.locationCountry || undefined,
        },
      ],
    };

    if (data.salaryMin && data.salaryMax) {
      input.desiredSalary = {
        min: Number(data.salaryMin),
        max: Number(data.salaryMax),
        currency: data.salaryCurrency,
        period: 'yearly',
      };
    }

    await onSubmit(input);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile ? t('searchProfiles.editTitle') : t('searchProfiles.createTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <Input
            label={t('searchProfiles.nameLabel')}
            placeholder={t('searchProfiles.namePlaceholder')}
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label={t('searchProfiles.positionsLabel')}
            placeholder={t('searchProfiles.positionsPlaceholder')}
            {...register('desiredPositions')}
          />

          <Input
            label={t('searchProfiles.technologiesLabel')}
            placeholder={t('searchProfiles.technologiesPlaceholder')}
            {...register('desiredTechnologies')}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              {t('searchProfiles.experienceLevelLabel')}
            </label>
            <Controller
              control={control}
              name="experienceLevel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => t(`searchProfiles.experienceLevels.${value}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intern">{t('searchProfiles.experienceLevels.intern')}</SelectItem>
                    <SelectItem value="junior">{t('searchProfiles.experienceLevels.junior')}</SelectItem>
                    <SelectItem value="middle">{t('searchProfiles.experienceLevels.middle')}</SelectItem>
                    <SelectItem value="senior">{t('searchProfiles.experienceLevels.senior')}</SelectItem>
                    <SelectItem value="lead">{t('searchProfiles.experienceLevels.lead')}</SelectItem>
                    <SelectItem value="principal">{t('searchProfiles.experienceLevels.principal')}</SelectItem>
                    <SelectItem value="executive">{t('searchProfiles.experienceLevels.executive')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('searchProfiles.minSalaryLabel')}
              type="number"
              placeholder="50000"
              {...register('salaryMin')}
            />
            <Input
              label={t('searchProfiles.maxSalaryLabel')}
              type="number"
              placeholder="100000"
              {...register('salaryMax')}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              {t('searchProfiles.currencyLabel')}
            </label>
            <Controller
              control={control}
              name="salaryCurrency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="UAH">UAH</SelectItem>
                    <SelectItem value="RUB">RUB</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('searchProfiles.cityLabel')}
              placeholder={t('searchProfiles.cityPlaceholder')}
              {...register('locationCity')}
            />
            <Input
              label={t('searchProfiles.countryLabel')}
              placeholder={t('searchProfiles.countryPlaceholder')}
              {...register('locationCountry')}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              {t('searchProfiles.workModeLabel')}
            </label>
            <Controller
              control={control}
              name="workMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => t(`searchProfiles.workModes.${value}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">{t('searchProfiles.workModes.remote')}</SelectItem>
                    <SelectItem value="hybrid">{t('searchProfiles.workModes.hybrid')}</SelectItem>
                    <SelectItem value="onsite">{t('searchProfiles.workModes.onsite')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Controller
            control={control}
            name="isRemoteOnly"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isRemoteOnly"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
                <label htmlFor="isRemoteOnly" className="text-sm text-foreground">
                  {t('searchProfiles.remoteOnlyLabel')}
                </label>
              </div>
            )}
          />

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('searchProfiles.saving') : profile ? t('searchProfiles.save') : t('searchProfiles.create')}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('searchProfiles.cancel')}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

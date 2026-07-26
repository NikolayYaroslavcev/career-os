'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/lib/i18n/i18n-provider';

const REGISTER_SCHEMA_SHAPE = {
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
};

function createRegisterSchema(t: (key: string) => string): z.ZodEffects<z.ZodObject<typeof REGISTER_SCHEMA_SHAPE>> {
  return z
    .object({
      ...REGISTER_SCHEMA_SHAPE,
      firstName: z.string().min(1, t('auth.validation.firstNameRequired')),
      lastName: z.string().min(1, t('auth.validation.lastNameRequired')),
      email: z.string().email(t('auth.validation.emailInvalid')),
      password: z.string().min(8, t('auth.validation.passwordMin')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.validation.passwordsMismatch'),
      path: ['confirmPassword'],
    });
}

type RegisterFormValues = z.infer<z.ZodEffects<z.ZodObject<typeof REGISTER_SCHEMA_SHAPE>>>;

export function RegisterForm(): React.JSX.Element {
  const router = useRouter();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();
  const { t } = useTranslation();

  const registerSchema = useMemo(() => createRegisterSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues): Promise<void> => {
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      router.push('/app');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('auth.register.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-xs font-medium underline underline-offset-2 hover:no-underline"
                >
                  {t('common.dismiss')}
                </button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('auth.register.firstNameLabel')}
              placeholder={t('auth.register.firstNamePlaceholder')}
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Input
              label={t('auth.register.lastNameLabel')}
              placeholder={t('auth.register.lastNamePlaceholder')}
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <Input
            label={t('auth.register.emailLabel')}
            type="email"
            placeholder={t('auth.register.emailPlaceholder')}
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label={t('auth.register.passwordLabel')}
            type="password"
            placeholder={t('auth.register.passwordPlaceholder')}
            error={errors.password?.message}
            {...register('password')}
          />

          <Input
            label={t('auth.register.confirmPasswordLabel')}
            type="password"
            placeholder={t('auth.register.passwordPlaceholder')}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('auth.register.submitting') : t('auth.register.submit')}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.register.haveAccount')}{' '}
            <a href="/login" className="text-primary hover:underline">
              {t('auth.register.signIn')}
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

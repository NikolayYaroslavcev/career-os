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

const LOGIN_SCHEMA_SHAPE = {
  email: z.string().email(),
  password: z.string().min(1),
};

function createLoginSchema(t: (key: string) => string): z.ZodObject<typeof LOGIN_SCHEMA_SHAPE> {
  return z.object({
    ...LOGIN_SCHEMA_SHAPE,
    email: z.string().email(t('auth.validation.emailInvalid')),
    password: z.string().min(1, t('auth.validation.passwordRequired')),
  });
}

type LoginFormValues = z.infer<z.ZodObject<typeof LOGIN_SCHEMA_SHAPE>>;

export function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { t } = useTranslation();

  const loginSchema = useMemo(() => createLoginSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues): Promise<void> => {
    try {
      await login(data.email, data.password);
      router.push('/app');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('auth.login.title')}</CardTitle>
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

          <Input
            label={t('auth.login.emailLabel')}
            type="email"
            placeholder={t('auth.login.emailPlaceholder')}
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label={t('auth.login.passwordLabel')}
            type="password"
            placeholder={t('auth.login.passwordPlaceholder')}
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.login.noAccount')}{' '}
            <a href="/register" className="text-primary hover:underline">
              {t('auth.login.signUp')}
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme/theme-provider';
import { useTranslation } from '@/lib/i18n/i18n-provider';

export function ThemeToggle({ className }: { className?: string }): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

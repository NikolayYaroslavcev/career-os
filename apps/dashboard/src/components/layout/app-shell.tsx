'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogOut, Briefcase, Search, Link as LinkIcon, FileText, KanbanSquare, Activity, Globe, Building2, Sparkles, LineChart, GitCompare, ListChecks, Wand2, Settings, Star, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/i18n-provider';

export function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();

  const navItems = [
    // Обзор
    { href: '/app', label: t('nav.dashboard'), icon: Briefcase },
    // Ядро продукта: поиск и отклики — используется чаще всего
    { href: '/app/intelligence', label: t('nav.findVacancies'), icon: Wand2 },
    { href: '/app/search', label: t('nav.search'), icon: ListChecks },
    { href: '/app/company-watch', label: t('nav.companyWatch'), icon: Building2 },
    { href: '/app/applications', label: t('nav.applications'), icon: KanbanSquare },
    { href: '/app/follow-ups', label: t('nav.followUps'), icon: BellRing },
    // Настройка: заполняется один раз, редактируется по мере необходимости
    { href: '/app/search-profiles', label: t('nav.searchProfiles'), icon: Search },
    { href: '/app/recommendations', label: 'Recommended Jobs', icon: Star },
    { href: '/app/resumes', label: t('nav.resumes'), icon: FileText },
    { href: '/app/sync', label: t('nav.jobSources'), icon: Globe },
    // Аналитика: периодические проверки
    { href: '/app/career-intelligence', label: t('nav.careerIntelligence'), icon: LineChart },
    { href: '/app/resume-intelligence', label: t('nav.resumeIntelligence'), icon: GitCompare },
    // Интеграции и системные разделы — используются реже всего
    { href: '/app/telegram', label: t('nav.telegram'), icon: LinkIcon },
    { href: '/app/ai', label: t('nav.ai'), icon: Sparkles },
    { href: '/app/diagnostics', label: t('nav.diagnostics'), icon: Activity },
    { href: '/app/settings/providers', label: 'Provider Settings', icon: Settings },
  ];

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r border-border bg-card">
        <div className="flex h-16 items-center border-b border-border px-6">
          <h1 className="text-xl font-bold text-foreground">{t('common.appName')}</h1>
        </div>

        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-64 border-t border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.email ?? t('common.user')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label={t('shell.logout')}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="h-16 border-b border-border bg-card px-6">
          <div className="flex h-full items-center">
            <h2 className="text-lg font-semibold text-foreground">
              {navItems.find((item) => item.href === pathname)?.label ?? t('common.appName')}
            </h2>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LogOut, Briefcase, Search, Link as LinkIcon, FileText, KanbanSquare, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from '@/lib/i18n/i18n-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();

  const navItems = [
    { href: '/app', label: t('nav.dashboard'), icon: Briefcase },
    { href: '/app/resumes', label: t('nav.resumes'), icon: FileText },
    { href: '/app/search-profiles', label: t('nav.searchProfiles'), icon: Search },
    { href: '/app/intelligence', label: t('nav.findVacancies'), icon: Search },
    { href: '/app/applications', label: t('nav.applications'), icon: KanbanSquare },
    { href: '/app/telegram', label: t('nav.telegram'), icon: LinkIcon },
    { href: '/app/diagnostics', label: t('nav.diagnostics'), icon: Activity },
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <h1 className="text-xl font-bold text-gray-900">{t('common.appName')}</h1>
        </div>

        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-64 border-t border-gray-200 p-4">
          <div className="mb-3">
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
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
        <div className="h-16 border-b border-gray-200 bg-white px-6">
          <div className="flex h-full items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              {navItems.find((item) => item.href === pathname)?.label ?? t('common.appName')}
            </h2>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

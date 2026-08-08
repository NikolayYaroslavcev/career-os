'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { useAuthStore } from '@/stores/auth-store';
import { isAdmin } from '@/lib/access/nav-visibility';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GitCompare,
  LineChart,
  MessageSquare,
  Wand2,
  FileText,
  DollarSign,
  Building2,
  Lightbulb,
  Compass,
} from 'lucide-react';

interface AIAction {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** Defaults to visible to any authenticated user when omitted. */
  adminOnly?: boolean;
}

const aiActions: AIAction[] = [
  { key: 'resumeIntelligence', icon: GitCompare, href: '/app/resume-intelligence' },
  { key: 'careerIntelligence', icon: LineChart, href: '/app/career-intelligence' },
  { key: 'resumeTailoring', icon: Wand2, href: '/app/intelligence' },
  { key: 'coverLetter', icon: FileText, href: '/app/intelligence' },
  { key: 'interviewPrep', icon: MessageSquare, href: '/app/intelligence' },
  { key: 'salaryAnalysis', icon: DollarSign, href: '/app/ai', adminOnly: true },
  { key: 'companyAnalysis', icon: Building2, href: '/app/ai', adminOnly: true },
  { key: 'resumeImprovement', icon: Lightbulb, href: '/app/resume-intelligence' },
  { key: 'careerAdvice', icon: Compass, href: '/app/career-intelligence' },
];

export function AIActionCards(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const canSeeAdminOnly = isAdmin(user);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboardHome.sections.aiCapabilities')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {aiActions.filter(action => !action.adminOnly || canSeeAdminOnly).map(action => {
            const Icon = action.icon;
            return (
              <Link
                key={action.key}
                href={action.href}
                className="group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary transition-colors group-hover:bg-primary/20">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t(`dashboardHome.aiActions.${action.key}`)}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {t(`dashboardHome.aiActions.${action.key}Desc`)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

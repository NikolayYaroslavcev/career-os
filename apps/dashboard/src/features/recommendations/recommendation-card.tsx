'use client';

import { MapPin, Clock, DollarSign, Check, X } from 'lucide-react';
import type { Recommendation } from '@/api/recommendations';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatNumber, formatDate as formatLocaleDate } from '@/lib/format';

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps): React.JSX.Element {
  const { locale } = useTranslation();
  const { vacancy, score, matchedSkills, reasons } = recommendation;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const formatSalary = (): string | null => {
    const { salaryMin, salaryMax } = vacancy;
    if (!salaryMin && !salaryMax) return null;
    const currency = vacancy.currency ?? 'USD';
    if (salaryMin && salaryMax) {
      return `${currency} ${formatNumber(salaryMin, locale)} - ${formatNumber(salaryMax, locale)}`;
    }
    if (salaryMin) {
      return `${currency} ${formatNumber(salaryMin, locale)}+`;
    }
    if (salaryMax) {
      return `Up to ${currency} ${formatNumber(salaryMax, locale)}`;
    }
    return null;
  };

  const formatDate = (dateString: string | null): string | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatLocaleDate(date, locale);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {vacancy.title}
            </h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getScoreColor(score)}`}>
              {score}% match
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            {vacancy.company}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{vacancy.location}</span>
            </div>
            {vacancy.remote === 'REMOTE' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Remote
              </span>
            )}
            {vacancy.remote === 'HYBRID' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                Hybrid
              </span>
            )}
            {formatSalary() && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                <span>{formatSalary()}</span>
              </div>
            )}
            {vacancy.publishedAt && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatDate(vacancy.publishedAt)}</span>
              </div>
            )}
          </div>

          {vacancy.technologies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {vacancy.technologies.map((tech) => (
                <span
                  key={tech}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    matchedSkills.includes(tech.toLowerCase())
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {reasons.slice(0, 4).map((reason, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                {reason.includes('matches') || reason.includes('as requested') || reason.includes('within') || reason.includes('High-quality') ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : reason.includes('mismatch') || reason.includes('below') || reason.includes('Not') ? (
                  <X className="h-4 w-4 text-red-600" />
                ) : (
                  <Check className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

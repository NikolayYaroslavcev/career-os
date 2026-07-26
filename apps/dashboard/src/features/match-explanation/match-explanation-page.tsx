'use client';

import { useState, useEffect } from 'react';
import {
  getMatchExplanation,
  getActionableItems,
  type ExplanationResponse,
  type ActionableItemsResponse,
} from '@/api/match-explanation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CategoryRadarChart } from './category-radar-chart';
import { ScoreBar } from './score-bar';
import { StrengthsWeaknesses } from './strengths-weaknesses';
import { ActionableItems } from './actionable-items';
import { MissingKeywords } from './missing-keywords';
import { Target, BarChart3 } from 'lucide-react';

interface MatchExplanationPageProps {
  matchResultId: string;
}

export function MatchExplanationPage({ matchResultId }: MatchExplanationPageProps): React.JSX.Element {
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [actionable, setActionable] = useState<ActionableItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [explData, actData] = await Promise.all([
          getMatchExplanation(matchResultId),
          getActionableItems(matchResultId),
        ]);
        setExplanation(explData);
        setActionable(actData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load explanation');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [matchResultId]);

  if (loading) return <Loading />;
  if (error) return <Alert><AlertDescription>{error}</AlertDescription></Alert>;
  if (!explanation) return <Alert><AlertDescription>No explanation data available</AlertDescription></Alert>;

  const { explanation: expl, categoryScores } = explanation;
  const overallPercent = expl?.overallPercent ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Match Explanation</h1>
      </div>

      {/* Overall Score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="relative">
              <svg className="w-32 h-32" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke={overallPercent >= 80 ? '#10b981' : overallPercent >= 60 ? '#3b82f6' : overallPercent >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(overallPercent / 100) * 339.292} 339.292`}
                  transform="rotate(-90 60 60)"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-900">{overallPercent}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Radar Chart + Score Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryRadarChart categoryScores={categoryScores} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Score Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryScores.map((cs, i) => (
              <ScoreBar key={i} score={cs} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Strengths & Weaknesses */}
      {expl && (
        <Card>
          <CardContent className="pt-6">
            <StrengthsWeaknesses
              strengths={expl.strengths}
              weaknesses={expl.weaknesses}
            />
          </CardContent>
        </Card>
      )}

      {/* Missing Keywords */}
      {expl && (
        <Card>
          <CardContent className="pt-6">
            <MissingKeywords keywords={expl.missingKeywords} />
          </CardContent>
        </Card>
      )}

      {/* Actionable Items */}
      {actionable && (
        <Card>
          <CardContent className="pt-6">
            <ActionableItems items={actionable.actionableItems} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

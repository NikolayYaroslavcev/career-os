export const MatchCategory = {
  TECHNICAL_SKILLS: 'technical_skills',
  EXPERIENCE: 'experience',
  SENIORITY: 'seniority',
  DOMAIN_KNOWLEDGE: 'domain_knowledge',
  LANGUAGE: 'language',
  LOCATION: 'location',
  SALARY: 'salary',
  REMOTE_PREFERENCE: 'remote_preference',
  CULTURE_FIT: 'culture_fit',
  CAREER_GROWTH: 'career_growth',
} as const;

export type MatchCategory = (typeof MatchCategory)[keyof typeof MatchCategory];

export interface CategoryScore {
  readonly category: MatchCategory;
  readonly label: string;
  readonly value: number;
  readonly weight: number;
  readonly confidence: number;
  readonly explanation: string;
}

export interface ActionableItem {
  readonly type: 'add_skill' | 'mention_keyword' | 'gain_experience' | 'adjust_expectation';
  readonly title: string;
  readonly description: string;
  readonly impact: number;
  readonly category: MatchCategory;
  readonly priority: 'high' | 'medium' | 'low';
}

export interface MatchExplanation {
  readonly overallPercent: number;
  readonly strengths: ReadonlyArray<{ readonly label: string; readonly detail: string }>;
  readonly weaknesses: ReadonlyArray<{ readonly label: string; readonly detail: string }>;
  readonly missingKeywords: readonly string[];
  readonly categoryScores: readonly CategoryScore[];
}

export const MATCH_CATEGORY_LABELS: Record<MatchCategory, string> = {
  [MatchCategory.TECHNICAL_SKILLS]: 'Technical Skills',
  [MatchCategory.EXPERIENCE]: 'Experience',
  [MatchCategory.SENIORITY]: 'Seniority',
  [MatchCategory.DOMAIN_KNOWLEDGE]: 'Domain Knowledge',
  [MatchCategory.LANGUAGE]: 'Language',
  [MatchCategory.LOCATION]: 'Location',
  [MatchCategory.SALARY]: 'Salary',
  [MatchCategory.REMOTE_PREFERENCE]: 'Remote Preference',
  [MatchCategory.CULTURE_FIT]: 'Culture Fit',
  [MatchCategory.CAREER_GROWTH]: 'Career Growth',
};

export const ALL_MATCH_CATEGORIES: readonly MatchCategory[] = Object.values(MatchCategory);

export type AtsCategoryId =
  | 'requiredSkills'
  | 'preferredSkills'
  | 'technology'
  | 'responsibility'
  | 'experience'
  | 'seniority'
  | 'industry'
  | 'education'
  | 'certifications'
  | 'language'
  | 'atsKeywords'
  | 'completeness'
  | 'formatting';

export type AtsWeights = Record<AtsCategoryId, number>;

export const ATS_CATEGORY_LABELS: Record<AtsCategoryId, string> = {
  requiredSkills: 'Required Skills Match',
  preferredSkills: 'Preferred Skills Match',
  technology: 'Technology Match',
  responsibility: 'Responsibility Match',
  experience: 'Experience Match',
  seniority: 'Seniority Match',
  industry: 'Industry Match',
  education: 'Education Match',
  certifications: 'Certifications Match',
  language: 'Language Match',
  atsKeywords: 'ATS Keyword Coverage',
  completeness: 'Resume Completeness',
  formatting: 'Formatting Quality',
};

/**
 * Weights for the deterministic ATS scoring engine (ADR-031 Phase 6/9). Kept
 * as one exported, versioned config object — not scattered magic numbers —
 * so the weighting scheme can evolve (bump ATS_WEIGHTS_VERSION) without
 * touching the scoring algorithm itself. Every AtsScoreResult stamps the
 * weightsVersion it was computed under, so historical scores stay
 * interpretable even after weights change. Sums to 100.
 */
export const ATS_WEIGHTS_VERSION = '1.0.0';

export const DEFAULT_ATS_WEIGHTS: AtsWeights = {
  requiredSkills: 20,
  preferredSkills: 8,
  technology: 15,
  responsibility: 10,
  experience: 10,
  seniority: 8,
  industry: 4,
  education: 6,
  certifications: 4,
  language: 4,
  atsKeywords: 8,
  completeness: 2,
  formatting: 1,
};

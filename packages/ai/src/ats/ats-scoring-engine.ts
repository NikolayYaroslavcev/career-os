import { ATS_CATEGORY_LABELS, ATS_WEIGHTS_VERSION, DEFAULT_ATS_WEIGHTS, type AtsCategoryId, type AtsWeights } from './ats-weights-config.js';

export interface AtsResumeEvidence {
  readonly summary: string;
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly seniorityLevel?: string;
  readonly totalYearsOfExperience: number;
  readonly educationEntries: readonly string[];
  readonly certifications: readonly string[];
  readonly languages: readonly string[];
  readonly experienceBullets: readonly string[];
  readonly experienceJobCount: number;
}

export interface AtsVacancyRequirements {
  readonly seniority: string;
  readonly requiredSkills: readonly string[];
  readonly preferredSkills: readonly string[];
  readonly responsibilities: readonly string[];
  readonly atsKeywords: readonly string[];
  readonly technologies: readonly string[];
  readonly domain: string;
  readonly industry: string;
  readonly education: readonly string[];
  readonly certifications: readonly string[];
  readonly languageRequirements: readonly string[];
}

export interface AtsCategoryScore {
  readonly category: AtsCategoryId;
  readonly label: string;
  readonly weight: number;
  readonly applicable: boolean;
  readonly rawScore: number;
  readonly weightedScore: number;
  readonly matchedEvidence: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly confidence: number;
  readonly explanation: string;
}

export interface AtsScoreResult {
  readonly overallScore: number;
  readonly categories: readonly AtsCategoryScore[];
  readonly weightsVersion: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Deterministic normalized-substring overlap — no external NLP dependency. */
function computeOverlap(
  required: readonly string[],
  candidateTerms: readonly string[],
): { matched: string[]; missing: string[]; ratio: number } {
  if (required.length === 0) {
    return { matched: [], missing: [], ratio: 1 };
  }

  const normalizedCandidates = candidateTerms.map(normalize);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const term of required) {
    const normTerm = normalize(term);
    const isMatched = normalizedCandidates.some(
      (c) => c === normTerm || c.includes(normTerm) || normTerm.includes(c),
    );
    if (isMatched) {
      matched.push(term);
    } else {
      missing.push(term);
    }
  }

  return { matched, missing, ratio: matched.length / required.length };
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are',
  'will', 'have', 'has', 'our', 'their', 'a', 'an', 'to', 'of', 'in', 'on',
  'as', 'is', 'be', 'or', 'we', 'work', 'working',
]);

function significantWords(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function computeResponsibilityCoverage(
  responsibilities: readonly string[],
  experienceBullets: readonly string[],
): { matched: string[]; missing: string[]; ratio: number } {
  if (responsibilities.length === 0) {
    return { matched: [], missing: [], ratio: 1 };
  }

  const bulletText = normalize(experienceBullets.join(' \n '));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const responsibility of responsibilities) {
    const words = significantWords(responsibility);
    if (words.length === 0) {
      matched.push(responsibility);
      continue;
    }
    const coveredCount = words.filter((w) => bulletText.includes(w)).length;
    const covered = coveredCount / words.length >= 0.4;
    if (covered) {
      matched.push(responsibility);
    } else {
      missing.push(responsibility);
    }
  }

  return { matched, missing, ratio: matched.length / responsibilities.length };
}

const SENIORITY_RANK: Record<string, number> = {
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  executive: 5,
};

const SENIORITY_YEARS_RANGE: Record<string, [number, number]> = {
  junior: [0, 2],
  mid: [2, 5],
  senior: [5, 8],
  lead: [8, 12],
  executive: [12, 99],
};

function seniorityRank(level: string | undefined): number | undefined {
  if (!level) return undefined;
  return SENIORITY_RANK[normalize(level)];
}

function inferSeniorityFromYears(years: number): string {
  for (const [level, [min, max]] of Object.entries(SENIORITY_YEARS_RANGE)) {
    if (years >= min && years < max) return level;
  }
  return 'executive';
}

function scoreCategory(params: {
  category: AtsCategoryId;
  weight: number;
  applicable: boolean;
  rawScore: number;
  matchedEvidence: readonly string[];
  missingEvidence: readonly string[];
  confidence: number;
  explanation: string;
}): AtsCategoryScore {
  const rawScore = Math.max(0, Math.min(100, params.rawScore));
  return {
    category: params.category,
    label: ATS_CATEGORY_LABELS[params.category],
    weight: params.weight,
    applicable: params.applicable,
    rawScore,
    weightedScore: params.applicable ? (rawScore * params.weight) / 100 : 0,
    matchedEvidence: params.matchedEvidence,
    missingEvidence: params.missingEvidence,
    confidence: params.confidence,
    explanation: params.explanation,
  };
}

/**
 * Computes the ATS match score entirely in code — the LLM never assigns this
 * number (ADR-031 Phase 6/9). Same (resume, vacancy) input always produces
 * the same score: no randomness, no model call. Weights are versioned
 * (AtsScoreResult.weightsVersion) so historical scores stay interpretable
 * after the weighting scheme evolves. Categories with no corresponding
 * vacancy data (e.g. no stated education requirement) are marked
 * `applicable: false` and excluded from the weighted denominator rather than
 * penalizing the candidate for something the vacancy never asked for.
 */
export function computeAtsScore(
  resume: AtsResumeEvidence,
  vacancy: AtsVacancyRequirements,
  weights: AtsWeights = DEFAULT_ATS_WEIGHTS,
): AtsScoreResult {
  const candidateSkillsAndTech = [...resume.skills, ...resume.technologies];

  const requiredSkills = computeOverlap(vacancy.requiredSkills, candidateSkillsAndTech);
  const preferredSkills = computeOverlap(vacancy.preferredSkills, candidateSkillsAndTech);
  const technology = computeOverlap(vacancy.technologies, resume.technologies);
  const responsibility = computeResponsibilityCoverage(vacancy.responsibilities, resume.experienceBullets);
  const atsKeywords = computeOverlap(
    vacancy.atsKeywords,
    [...candidateSkillsAndTech, ...resume.experienceBullets, resume.summary],
  );
  const education = computeOverlap(vacancy.education, resume.educationEntries);
  const certifications = computeOverlap(vacancy.certifications, resume.certifications);
  const language = computeOverlap(vacancy.languageRequirements, resume.languages);

  const candidateSeniority = resume.seniorityLevel ?? inferSeniorityFromYears(resume.totalYearsOfExperience);
  const candidateRank = seniorityRank(candidateSeniority);
  const vacancyRank = seniorityRank(vacancy.seniority);
  const seniorityApplicable = vacancyRank !== undefined;
  const seniorityDistance =
    seniorityApplicable && candidateRank !== undefined ? Math.abs(candidateRank - vacancyRank) : undefined;
  const seniorityScore = seniorityDistance === undefined ? 50 : Math.max(0, 100 - seniorityDistance * 25);

  const [expMin] = SENIORITY_YEARS_RANGE[normalize(vacancy.seniority)] ?? [0, 0];
  const experienceApplicable = vacancyRank !== undefined;
  const experienceScore =
    !experienceApplicable
      ? 50
      : resume.totalYearsOfExperience >= expMin
        ? 100
        : Math.max(0, (resume.totalYearsOfExperience / Math.max(expMin, 1)) * 100);

  const industryHaystack = normalize(
    [resume.summary, ...candidateSkillsAndTech, ...resume.experienceBullets].join(' '),
  );
  const industryApplicable = vacancy.industry.trim().length > 0 || vacancy.domain.trim().length > 0;
  const industryTerm = normalize(vacancy.industry || vacancy.domain);
  const industryMatched = industryApplicable && industryTerm.length > 0 && industryHaystack.includes(industryTerm);
  const industryScore = !industryApplicable ? 50 : industryMatched ? 100 : 30;

  const expectedSections = [
    resume.summary.trim().length > 0,
    resume.skills.length > 0,
    resume.experienceJobCount > 0,
    resume.educationEntries.length > 0,
    resume.technologies.length > 0,
  ];
  const completenessRatio = expectedSections.filter(Boolean).length / expectedSections.length;

  const bulletLengths = resume.experienceBullets.map((b) => b.length);
  const wellFormedBullets = bulletLengths.filter((len) => len >= 15 && len <= 260).length;
  const bulletQualityRatio = resume.experienceBullets.length
    ? wellFormedBullets / resume.experienceBullets.length
    : 0.5;
  const skillsCountReasonable = resume.skills.length >= 3 && resume.skills.length <= 40;
  const formattingScore = bulletQualityRatio * 80 + (skillsCountReasonable ? 20 : 0);

  const categories: AtsCategoryScore[] = [
    scoreCategory({
      category: 'requiredSkills',
      weight: weights.requiredSkills,
      applicable: vacancy.requiredSkills.length > 0,
      rawScore: requiredSkills.ratio * 100,
      matchedEvidence: requiredSkills.matched,
      missingEvidence: requiredSkills.missing,
      confidence: vacancy.requiredSkills.length > 0 ? 0.9 : 0,
      explanation: `${requiredSkills.matched.length}/${vacancy.requiredSkills.length || 0} required skills found in the resume.`,
    }),
    scoreCategory({
      category: 'preferredSkills',
      weight: weights.preferredSkills,
      applicable: vacancy.preferredSkills.length > 0,
      rawScore: preferredSkills.ratio * 100,
      matchedEvidence: preferredSkills.matched,
      missingEvidence: preferredSkills.missing,
      confidence: vacancy.preferredSkills.length > 0 ? 0.85 : 0,
      explanation: `${preferredSkills.matched.length}/${vacancy.preferredSkills.length || 0} preferred skills found in the resume.`,
    }),
    scoreCategory({
      category: 'technology',
      weight: weights.technology,
      applicable: vacancy.technologies.length > 0,
      rawScore: technology.ratio * 100,
      matchedEvidence: technology.matched,
      missingEvidence: technology.missing,
      confidence: vacancy.technologies.length > 0 ? 0.9 : 0,
      explanation: `${technology.matched.length}/${vacancy.technologies.length || 0} required technologies found in the resume.`,
    }),
    scoreCategory({
      category: 'responsibility',
      weight: weights.responsibility,
      applicable: vacancy.responsibilities.length > 0,
      rawScore: responsibility.ratio * 100,
      matchedEvidence: responsibility.matched,
      missingEvidence: responsibility.missing,
      confidence: vacancy.responsibilities.length > 0 ? 0.6 : 0,
      explanation: `${responsibility.matched.length}/${vacancy.responsibilities.length || 0} listed responsibilities are covered by the resume's experience bullets.`,
    }),
    scoreCategory({
      category: 'experience',
      weight: weights.experience,
      applicable: experienceApplicable,
      rawScore: experienceScore,
      matchedEvidence: experienceApplicable ? [`${resume.totalYearsOfExperience} years of experience`] : [],
      missingEvidence: experienceApplicable && experienceScore < 100 ? [`${expMin}+ years expected for ${vacancy.seniority}`] : [],
      confidence: experienceApplicable ? 0.75 : 0,
      explanation: experienceApplicable
        ? `Candidate has ${resume.totalYearsOfExperience} years vs. an expected ${expMin}+ years for a ${vacancy.seniority} role.`
        : 'Vacancy does not specify a seniority level to compare years of experience against.',
    }),
    scoreCategory({
      category: 'seniority',
      weight: weights.seniority,
      applicable: seniorityApplicable,
      rawScore: seniorityScore,
      matchedEvidence: seniorityApplicable ? [candidateSeniority] : [],
      missingEvidence: seniorityApplicable && seniorityScore < 100 ? [vacancy.seniority] : [],
      confidence: seniorityApplicable ? 0.7 : 0,
      explanation: seniorityApplicable
        ? `Candidate seniority "${candidateSeniority}" compared against vacancy seniority "${vacancy.seniority}".`
        : 'Vacancy does not specify a recognizable seniority level.',
    }),
    scoreCategory({
      category: 'industry',
      weight: weights.industry,
      applicable: industryApplicable,
      rawScore: industryScore,
      matchedEvidence: industryMatched ? [vacancy.industry || vacancy.domain] : [],
      missingEvidence: industryApplicable && !industryMatched ? [vacancy.industry || vacancy.domain] : [],
      confidence: industryApplicable ? 0.4 : 0,
      explanation: industryApplicable
        ? `Checked whether "${vacancy.industry || vacancy.domain}" appears anywhere in the resume's summary/skills/experience.`
        : 'Vacancy does not specify an industry or domain.',
    }),
    scoreCategory({
      category: 'education',
      weight: weights.education,
      applicable: vacancy.education.length > 0,
      rawScore: education.ratio * 100,
      matchedEvidence: education.matched,
      missingEvidence: education.missing,
      confidence: vacancy.education.length > 0 ? 0.7 : 0,
      explanation: `${education.matched.length}/${vacancy.education.length || 0} education requirements found in the resume.`,
    }),
    scoreCategory({
      category: 'certifications',
      weight: weights.certifications,
      applicable: vacancy.certifications.length > 0,
      rawScore: certifications.ratio * 100,
      matchedEvidence: certifications.matched,
      missingEvidence: certifications.missing,
      confidence: vacancy.certifications.length > 0 ? 0.8 : 0,
      explanation: `${certifications.matched.length}/${vacancy.certifications.length || 0} required certifications found in the resume.`,
    }),
    scoreCategory({
      category: 'language',
      weight: weights.language,
      applicable: vacancy.languageRequirements.length > 0,
      rawScore: language.ratio * 100,
      matchedEvidence: language.matched,
      missingEvidence: language.missing,
      confidence: vacancy.languageRequirements.length > 0 ? 0.7 : 0,
      explanation: `${language.matched.length}/${vacancy.languageRequirements.length || 0} language requirements found in the resume.`,
    }),
    scoreCategory({
      category: 'atsKeywords',
      weight: weights.atsKeywords,
      applicable: vacancy.atsKeywords.length > 0,
      rawScore: atsKeywords.ratio * 100,
      matchedEvidence: atsKeywords.matched,
      missingEvidence: atsKeywords.missing,
      confidence: vacancy.atsKeywords.length > 0 ? 0.85 : 0,
      explanation: `${atsKeywords.matched.length}/${vacancy.atsKeywords.length || 0} ATS keywords found in the resume.`,
    }),
    scoreCategory({
      category: 'completeness',
      weight: weights.completeness,
      applicable: true,
      rawScore: completenessRatio * 100,
      matchedEvidence: [],
      missingEvidence: [],
      confidence: 1,
      explanation: `${Math.round(completenessRatio * expectedSections.length)}/${expectedSections.length} expected resume sections are populated.`,
    }),
    scoreCategory({
      category: 'formatting',
      weight: weights.formatting,
      applicable: true,
      rawScore: formattingScore,
      matchedEvidence: [],
      missingEvidence: [],
      confidence: 0.6,
      explanation: `${wellFormedBullets}/${resume.experienceBullets.length || 0} bullets are a reasonable ATS-parseable length; skills list has ${resume.skills.length} entries.`,
    }),
  ];

  const applicableCategories = categories.filter((c) => c.applicable);
  const totalApplicableWeight = applicableCategories.reduce((sum, c) => sum + c.weight, 0);
  const overallScore =
    totalApplicableWeight > 0
      ? Math.round(
          (applicableCategories.reduce((sum, c) => sum + c.weightedScore, 0) / totalApplicableWeight) * 100,
        )
      : 0;

  return {
    overallScore,
    categories,
    weightsVersion: ATS_WEIGHTS_VERSION,
  };
}

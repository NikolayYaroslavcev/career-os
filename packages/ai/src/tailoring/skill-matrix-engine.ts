import type { AtsResumeEvidence, AtsVacancyRequirements } from '../ats/ats-scoring-engine.js';

export interface SkillMatrixResult {
  readonly matchedSkills: readonly string[];
  readonly missingSkills: readonly string[];
  readonly weakSkills: readonly string[];
  readonly strongSkills: readonly string[];
  readonly atsKeywordCoverageRatio: number;
  readonly technologyCoverageRatio: number;
  readonly responsibilityCoverageRatio: number;
  readonly experienceCoverageRatio: number;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isMentioned(term: string, haystack: string): boolean {
  const normTerm = normalize(term);
  return haystack.includes(normTerm);
}

/**
 * Deterministic (no LLM) skill-matrix computation — ADR-031 Stage 3. Splits
 * a candidate's skills into "strong" (also evidenced in an experience
 * bullet, not just listed) vs "weak" (present in the skills list only), and
 * reports coverage ratios reused by the ATS engine's explanation surface but
 * exposed here as a standalone, user-facing artifact.
 */
export function computeSkillMatrix(
  resume: AtsResumeEvidence,
  vacancy: AtsVacancyRequirements,
): SkillMatrixResult {
  const bulletsHaystack = normalize(resume.experienceBullets.join(' \n '));
  const candidateTerms = [...resume.skills, ...resume.technologies].map(normalize);

  const requiredAndPreferred = [...vacancy.requiredSkills, ...vacancy.preferredSkills];
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const skill of requiredAndPreferred) {
    const normSkill = normalize(skill);
    const matched = candidateTerms.some((c) => c === normSkill || c.includes(normSkill) || normSkill.includes(c));
    if (matched) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  const weakSkills: string[] = [];
  const strongSkills: string[] = [];
  for (const skill of resume.skills) {
    if (isMentioned(skill, bulletsHaystack)) {
      strongSkills.push(skill);
    } else {
      weakSkills.push(skill);
    }
  }

  const atsKeywordCoverageRatio = vacancy.atsKeywords.length
    ? vacancy.atsKeywords.filter((k) => candidateTerms.some((c) => isMentioned(k, c) || isMentioned(c, k)) || isMentioned(k, bulletsHaystack)).length /
      vacancy.atsKeywords.length
    : 1;

  const technologyCoverageRatio = vacancy.technologies.length
    ? vacancy.technologies.filter((t) =>
        resume.technologies.some((rt) => normalize(rt) === normalize(t) || normalize(rt).includes(normalize(t))),
      ).length / vacancy.technologies.length
    : 1;

  const responsibilityCoverageRatio = vacancy.responsibilities.length
    ? vacancy.responsibilities.filter((r) => {
        const words = normalize(r)
          .split(/[^a-z0-9+#.]+/)
          .filter((w) => w.length > 3);
        if (words.length === 0) return true;
        const coveredCount = words.filter((w) => bulletsHaystack.includes(w)).length;
        return coveredCount / words.length >= 0.4;
      }).length / vacancy.responsibilities.length
    : 1;

  const experienceCoverageRatio = (() => {
    const rank: Record<string, number> = { junior: 1, mid: 2, senior: 3, lead: 4, executive: 5 };
    const vacancyRank = rank[normalize(vacancy.seniority)];
    if (vacancyRank === undefined) return 1;
    const candidateRank = rank[normalize(resume.seniorityLevel ?? '')] ?? Math.min(5, Math.max(1, Math.ceil(resume.totalYearsOfExperience / 2.5)));
    return Math.max(0, 1 - Math.abs(candidateRank - vacancyRank) * 0.25);
  })();

  return {
    matchedSkills,
    missingSkills,
    weakSkills,
    strongSkills,
    atsKeywordCoverageRatio,
    technologyCoverageRatio,
    responsibilityCoverageRatio,
    experienceCoverageRatio,
  };
}

import type { ResumeId } from '@careeros/career';
import type { ResumeContextProvider } from '../context/resume-context-provider.js';
import type { AtsResumeEvidence } from '../ats/ats-scoring-engine.js';

export interface TailoringExperienceEvidence {
  readonly jobIndex: number;
  readonly company: string;
  readonly position: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly technologies: readonly string[];
}

export interface TailoringResumeEvidence {
  readonly source: 'structured' | 'fallback_raw';
  readonly summary: string;
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly seniorityLevel?: string;
  readonly totalYearsOfExperience: number;
  readonly experience: readonly TailoringExperienceEvidence[];
  readonly education: readonly { institution: string; degree: string; field: string }[];
  readonly certifications: readonly string[];
  readonly languages: readonly string[];
}

/**
 * Stage 1 (Parsing Resume): wraps the existing ResumeContextProvider — which
 * already resolves StructuredResume-or-fallback (ADR-024) — and reshapes it
 * into the per-job, bullet-indexed evidence the tailoring pipeline needs
 * (ADR-031). Deliberately does not duplicate ResumeContextProvider's
 * extraction-triggering/fallback logic; it only adapts its output.
 */
export class ResumeEvidenceBuilder {
  constructor(private readonly contextProvider: ResumeContextProvider) {}

  async build(resumeId: ResumeId, budgetTokens: number): Promise<TailoringResumeEvidence> {
    const context = await this.contextProvider.getContext(resumeId, budgetTokens);

    return {
      source: context.source,
      summary: context.summary,
      skills: context.skills,
      technologies: context.technologies,
      seniorityLevel: context.seniorityLevel,
      totalYearsOfExperience: context.totalYearsOfExperience,
      experience: context.experience.map((exp, jobIndex) => ({
        jobIndex,
        company: exp.company,
        position: exp.position,
        description: exp.description,
        bullets: exp.bullets,
        technologies: exp.technologies,
      })),
      education: context.education,
      certifications: context.certifications,
      languages: context.languages,
    };
  }
}

export function toAtsResumeEvidence(evidence: TailoringResumeEvidence): AtsResumeEvidence {
  return {
    summary: evidence.summary,
    skills: evidence.skills,
    technologies: evidence.technologies,
    seniorityLevel: evidence.seniorityLevel,
    totalYearsOfExperience: evidence.totalYearsOfExperience,
    educationEntries: evidence.education.map((edu) => `${edu.degree} in ${edu.field} — ${edu.institution}`),
    certifications: evidence.certifications,
    languages: evidence.languages,
    experienceBullets: evidence.experience.flatMap((exp) => (exp.bullets.length > 0 ? exp.bullets : [exp.description])),
    experienceJobCount: evidence.experience.length,
  };
}

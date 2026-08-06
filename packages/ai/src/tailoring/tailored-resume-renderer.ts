export interface RenderableExperience {
  readonly company: string;
  readonly position: string;
  readonly bullets: readonly string[];
  readonly technologies: readonly string[];
}

export interface RenderTailoredResumeInput {
  readonly summary: string;
  readonly experience: readonly RenderableExperience[];
  readonly skills: readonly string[];
  readonly education: readonly { institution: string; degree: string; field: string }[];
}

/**
 * Deterministically renders the final plain-text resume from verified
 * structured content (ADR-031 Stage 7 / "Saving Results"). The LLM never
 * authors this text directly — the old prompt's freeform `tailoredResume`
 * field was a second, drifting source of truth alongside `reorderedExperience`;
 * this function is now the single source of truth for the rendered text,
 * and only runs after the reviewer stage has corrected/reverted any
 * unsupported bullets.
 */
export function renderTailoredResume(input: RenderTailoredResumeInput): string {
  const sections: string[] = [];

  if (input.summary.trim()) {
    sections.push(`SUMMARY\n${input.summary.trim()}`);
  }

  if (input.experience.length > 0) {
    const experienceText = input.experience
      .map((exp) => {
        const header = [exp.position, exp.company].filter(Boolean).join(' — ');
        const bulletsText = exp.bullets.map((b) => `- ${b}`).join('\n');
        const techLine = exp.technologies.length ? `\nTechnologies: ${exp.technologies.join(', ')}` : '';
        return `${header}${techLine}\n${bulletsText}`;
      })
      .join('\n\n');
    sections.push(`EXPERIENCE\n${experienceText}`);
  }

  if (input.skills.length > 0) {
    sections.push(`SKILLS\n${input.skills.join(', ')}`);
  }

  if (input.education.length > 0) {
    const educationText = input.education
      .map((edu) => `${edu.degree} in ${edu.field} — ${edu.institution}`)
      .join('\n');
    sections.push(`EDUCATION\n${educationText}`);
  }

  return sections.join('\n\n');
}

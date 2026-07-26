import type { ResumeId, Resume, StructuredResume, StructuredResumeRepository } from '@careeros/career';
import type { ResumeRepository } from '@careeros/career';

export interface ResumeExperienceContext {
  readonly company: string;
  readonly position: string;
  readonly description: string;
  readonly technologies: readonly string[];
}

export interface ResumeAIContext {
  readonly source: 'structured' | 'fallback_raw';
  readonly summary: string;
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly experience: readonly ResumeExperienceContext[];
  readonly totalYearsOfExperience: number;
  readonly promptText: string;
  readonly estimatedTokens: number;
}

export interface ResumeContextProvider {
  getContext(resumeId: ResumeId, budgetTokens: number): Promise<ResumeAIContext>;
}

export interface ResumeContextProviderDeps {
  readonly resumeRepository: ResumeRepository;
  readonly structuredResumeRepository: StructuredResumeRepository;
  readonly extractionVersion: string;
  readonly fallbackContextBuilder: (rawText: string, budgetTokens: number, maxChars: number) => string;
  readonly tokenEstimator: (text: string) => number;
}

function serializeStructuredToPromptText(
  structured: StructuredResume,
  budgetTokens: number,
  tokenEstimator: (text: string) => number,
): string {
  const parts: string[] = [];

  if (structured.summary) {
    parts.push(`## Summary\n${structured.summary}`);
  }

  if (structured.seniorityLevel) {
    parts.push(`## Seniority\n${structured.seniorityLevel}`);
  }

  if (structured.totalYearsOfExperience !== undefined) {
    parts.push(`## Experience\n${structured.totalYearsOfExperience} years`);
  }

  if (structured.skills.length > 0) {
    parts.push(`## Skills\n${structured.skills.join(', ')}`);
  }

  if (structured.technologies.length > 0) {
    parts.push(`## Technologies\n${structured.technologies.join(', ')}`);
  }

  if (structured.experience.length > 0) {
    const experienceText = structured.experience
      .map((exp) => {
        const dates = exp.endDate
          ? `${exp.startDate.toISOString().slice(0, 7)} - ${exp.endDate.toISOString().slice(0, 7)}`
          : `${exp.startDate.toISOString().slice(0, 7)} - Present`;
        return `${exp.position} at ${exp.company} (${dates})\n${exp.description}\nTechnologies: ${exp.technologies.join(', ')}`;
      })
      .join('\n\n');
    parts.push(`## Work Experience\n${experienceText}`);
  }

  if (structured.education.length > 0) {
    const educationText = structured.education
      .map((edu) => {
        const dates = edu.endDate
          ? `${edu.startDate.toISOString().slice(0, 7)} - ${edu.endDate.toISOString().slice(0, 7)}`
          : `${edu.startDate.toISOString().slice(0, 7)} - Present`;
        return `${edu.degree} in ${edu.field}, ${edu.institution} (${dates})`;
      })
      .join('\n');
    parts.push(`## Education\n${educationText}`);
  }

  let text = parts.join('\n\n');
  let tokens = tokenEstimator(text);

  while (tokens > budgetTokens && parts.length > 0) {
    parts.pop();
    text = parts.join('\n\n');
    tokens = tokenEstimator(text);
  }

  return text;
}

function estimateExperienceYears(experience: readonly { startDate: Date; endDate?: Date }[]): number {
  const [first, ...rest] = experience;
  if (!first) return 0;

  const earliest = rest.reduce((min, exp) => {
    return exp.startDate < min ? exp.startDate : min;
  }, first.startDate);

  const now = new Date();
  const diffMs = now.getTime() - earliest.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
}

export class ResumeContextProviderImpl implements ResumeContextProvider {
  constructor(private readonly deps: ResumeContextProviderDeps) {}

  async getContext(resumeId: ResumeId, budgetTokens: number): Promise<ResumeAIContext> {
    const resume = await this.deps.resumeRepository.findById(resumeId);
    if (!resume) {
      throw new Error(`Resume not found: ${resumeId}`);
    }

    const rawText = resume.rawText ?? '';
    if (!rawText) {
      return this.createFallbackContext(resume, budgetTokens, '');
    }

    const structured = await this.deps.structuredResumeRepository.findByResumeId(resumeId);

    if (structured && structured.isFreshFor(this.computeHash(rawText), this.deps.extractionVersion)) {
      return this.createStructuredContext(structured, budgetTokens);
    }

    return this.createFallbackContext(resume, budgetTokens, rawText);
  }

  private createStructuredContext(
    structured: StructuredResume,
    budgetTokens: number,
  ): ResumeAIContext {
    const experience: ResumeExperienceContext[] = structured.experience.map((exp) => ({
      company: exp.company,
      position: exp.position,
      description: exp.description,
      technologies: exp.technologies,
    }));

    const promptText = serializeStructuredToPromptText(structured, budgetTokens, this.deps.tokenEstimator);

    return {
      source: 'structured',
      summary: structured.summary ?? '',
      skills: structured.skills,
      technologies: structured.technologies,
      experience,
      totalYearsOfExperience: structured.totalYearsOfExperience ?? estimateExperienceYears(structured.experience),
      promptText,
      estimatedTokens: this.deps.tokenEstimator(promptText),
    };
  }

  private createFallbackContext(
    resume: Resume,
    budgetTokens: number,
    rawText: string,
  ): ResumeAIContext {
    const promptText = this.deps.fallbackContextBuilder(rawText, budgetTokens, rawText.length);

    return {
      source: 'fallback_raw',
      summary: resume.summary,
      skills: resume.skills.map((s) => s.name),
      technologies: resume.technologies.map((t) => t.name),
      experience: resume.experience.map((exp) => ({
        company: exp.company,
        position: exp.position,
        description: exp.description,
        technologies: exp.technologies.map((t) => t.name),
      })),
      totalYearsOfExperience: resume.totalYearsOfExperience,
      promptText,
      estimatedTokens: this.deps.tokenEstimator(promptText),
    };
  }

  private computeHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash.toString(16);
  }
}

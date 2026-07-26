import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

export interface CoverLetterParams {
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly companyIndustry?: string;
  readonly companySize?: string;
  readonly technologies: readonly string[];
  readonly experienceLevel?: string;
  readonly location?: string;

  readonly resumeSummary: string;
  readonly resumeExperience: readonly {
    readonly company: string;
    readonly position: string;
    readonly description: string;
    readonly technologies: readonly string[];
  }[];
  readonly resumeSkills: readonly string[];
  readonly resumeTechnologies: readonly string[];
}

const SYSTEM_PROMPT = `You are an expert cover letter writer. Your task is to write a personalized, compelling cover letter for a specific job vacancy.

You must respond with a JSON object matching this exact schema:
{
  "coverLetter": "<complete cover letter text>",
  "tone": "<formal|conversational|technical>",
  "keyPoints": ["<point1>", "<point2>", "<point3>"]
}

Rules:
- Write a genuine, specific cover letter — NO generic templates
- Reference specific requirements from the job posting
- Connect the candidate's actual experience to the company's needs
- Keep it under 400 words (3-4 paragraphs)
- Paragraph 1: Hook — why this role at this company specifically
- Paragraph 2: Evidence — concrete experience matching their requirements
- Paragraph 3: Value — what the candidate brings that others might not
- Paragraph 4: Close — call to action, enthusiasm
- Match tone to company culture:
  * Startup/tech company → conversational, direct
  * Enterprise/corporate → formal, professional
  * Research/academic → technical, evidence-based
- Do NOT use clichés like "I'm writing to express my interest" or "I believe I would be a great fit"
- Do NOT repeat the resume — add context and personality
- Mention specific technologies from the job posting when relevant
- If company industry/size is available, reference it naturally
${UNTRUSTED_CONTENT_SYSTEM_RULE}`;

const USER_PROMPT_TEMPLATE = (params: CoverLetterParams): string => {
  const experienceText = params.resumeExperience
    .slice(0, 3)
    .map(
      (exp) =>
        `${exp.position} at ${exp.company}: ${exp.description.slice(0, 200)}`,
    )
    .join('\n');

  const companyContext = [
    params.companyIndustry && `Industry: ${params.companyIndustry}`,
    params.companySize && `Size: ${params.companySize}`,
    params.location && `Location: ${params.location}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `## Job Vacancy
Title: ${params.vacancyTitle}
Company: ${params.companyName}
${companyContext ? `\nCompany Context:\n${companyContext}\n` : ''}
Experience Level: ${params.experienceLevel || 'Not specified'}
Technologies: ${params.technologies.join(', ')}

Job Description:
${wrapUntrustedContent('VACANCY_DESCRIPTION', params.vacancyDescription)}

## Candidate Background
Summary: ${params.resumeSummary}

Recent Experience:
${experienceText}

Key Skills: ${params.resumeSkills.slice(0, 10).join(', ')}
Technologies: ${params.resumeTechnologies.join(', ')}

Please write a personalized cover letter for this application. Follow all rules specified in the system prompt.`;
};

export class CoverLetterPromptBuilder implements PromptBuilder<CoverLetterParams> {
  readonly promptId = 'cover-letter';
  readonly currentVersion = '1.1.0';

  build(params: CoverLetterParams): BuiltPrompt {
    return {
      system: SYSTEM_PROMPT,
      user: USER_PROMPT_TEMPLATE(params),
      version: this.getVersion(),
    };
  }

  getVersion(): PromptVersion {
    return createPromptVersion(this.promptId, this.currentVersion, SYSTEM_PROMPT);
  }
}

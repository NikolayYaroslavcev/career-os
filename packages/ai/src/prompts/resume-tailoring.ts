import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

export interface ResumeTailoringParams {
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly technologies: readonly string[];
  readonly experienceLevel?: string;
  readonly requirements?: readonly string[];

  readonly resumeSummary: string;
  readonly resumeExperience: readonly {
    readonly company: string;
    readonly position: string;
    readonly description: string;
    readonly technologies: readonly string[];
  }[];
  readonly resumeSkills: readonly string[];
  readonly resumeTechnologies: readonly string[];
  readonly resumeEducation: readonly {
    readonly institution: string;
    readonly degree: string;
    readonly field: string;
  }[];
}

const SYSTEM_PROMPT = `You are an expert resume writer and career coach. Your task is to tailor a candidate's existing resume for a specific job vacancy.

You must respond with a JSON object matching this exact schema:
{
  "optimizedSummary": "<rewritten professional summary targeting this specific role>",
  "reorderedExperience": [
    {
      "company": "<company name>",
      "position": "<position title>",
      "description": "<rewritten description emphasizing relevant achievements>",
      "technologies": ["<tech1>", "<tech2>"],
      "relevanceScore": <0-100>
    }
  ],
  "emphasizedSkills": ["<skill1>", "<skill2>", "..."],
  "keywordOptimizations": ["<keyword1>", "<keyword2>"],
  "tailoredResume": "<complete tailored resume text in plain text format>"
}

Rules:
- NEVER fabricate experience, skills, or education not present in the original resume
- REORDER experience entries so the most relevant ones come first
- REWRITE experience descriptions to emphasize achievements relevant to the target role
- REWRITE the summary to directly address the job requirements
- REORDER skills to highlight the most relevant ones first
- ADD keywords from the job posting naturally into the resume (not keyword stuffing)
- PRESERVE all original information — just reframe and reorganize it
- The tailoredResume field should be a complete, ready-to-use plain text resume
- Keep the same overall structure: Summary → Experience → Skills → Education
- Quantify achievements where possible (numbers, percentages, metrics)
- Use action verbs and industry-standard resume language
${UNTRUSTED_CONTENT_SYSTEM_RULE}`;

const USER_PROMPT_TEMPLATE = (params: ResumeTailoringParams): string => {
  const experienceText = params.resumeExperience
    .map(
      (exp) =>
        `${exp.position} at ${exp.company}\nTechnologies: ${exp.technologies.join(', ')}\n${exp.description}`,
    )
    .join('\n\n');

  const educationText = params.resumeEducation
    .map((edu) => `${edu.degree} in ${edu.field} — ${edu.institution}`)
    .join('\n');

  const requirementsText = params.requirements?.length
    ? `\nKey Requirements:\n${params.requirements.map((r) => `- ${r}`).join('\n')}`
    : '';

  return `## Job Vacancy
Title: ${params.vacancyTitle}
Company: ${params.companyName}
Experience Level: ${params.experienceLevel || 'Not specified'}
Technologies: ${params.technologies.join(', ')}
${requirementsText}

Job Description:
${wrapUntrustedContent('VACANCY_DESCRIPTION', params.vacancyDescription)}

## Original Resume

Summary:
${params.resumeSummary}

Experience:
${experienceText}

Skills: ${params.resumeSkills.join(', ')}
Technologies: ${params.resumeTechnologies.join(', ')}

Education:
${educationText}

Please tailor this resume for the above job vacancy. Follow all rules specified in the system prompt.`;
};

export class ResumeTailoringPromptBuilder implements PromptBuilder<ResumeTailoringParams> {
  readonly promptId = 'resume-tailoring';
  readonly currentVersion = '1.1.0';

  build(params: ResumeTailoringParams): BuiltPrompt {
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

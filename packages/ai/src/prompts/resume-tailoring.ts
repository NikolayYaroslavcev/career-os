import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

export interface ResumeTailoringExperienceInput {
  readonly company: string;
  readonly position: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly technologies: readonly string[];
}

export interface ResumeTailoringParams {
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly technologies: readonly string[];
  readonly experienceLevel?: string;
  readonly requirements?: readonly string[];

  readonly resumeSummary: string;
  readonly resumeExperience: readonly ResumeTailoringExperienceInput[];
  readonly resumeSkills: readonly string[];
  readonly resumeTechnologies: readonly string[];
  readonly resumeEducation: readonly {
    readonly institution: string;
    readonly degree: string;
    readonly field: string;
  }[];
}

// ADR-031: the LLM no longer emits a freeform "tailoredResume" full-text
// field — that used to duplicate reorderedExperience as a second, drifting
// source of truth. The final resume text is now rendered deterministically
// in code (TailoredResumeRenderer) from this structured output only. Every
// bullet must also carry sourceBulletIndex so the reviewer stage can verify
// it against the specific original bullet it claims to be derived from.
const SYSTEM_PROMPT = `You are an expert resume writer and career coach. Your task is to tailor a candidate's existing resume for a specific job vacancy.

You must respond with a JSON object matching this exact schema:
{
  "optimizedSummary": "<rewritten professional summary targeting this specific role, built only from facts in the original summary/experience>",
  "reorderedExperience": [
    {
      "sourceJobIndex": <the "Job [N]" index (0-based) from the input that this entry is derived from>,
      "company": "<company name, copied exactly from the original resume>",
      "position": "<position title, copied exactly from the original resume>",
      "bullets": [
        {
          "text": "<rewritten achievement/responsibility line, emphasizing relevance to the target role>",
          "sourceBulletIndex": <index (0-based) into this job's original "bullets" array that this rewritten line is derived from, or -1 if the job had no bullets and this line was derived only from its description>
        }
      ],
      "technologies": ["<tech1>", "<tech2>"],
      "relevanceScore": <0-100>
    }
  ],
  "emphasizedSkills": ["<skill1>", "<skill2>", "..."],
  "keywordOptimizations": ["<keyword1>", "<keyword2>"]
}

Rules:
- NEVER fabricate experience, employers, projects, technologies, skills, education, or achievements not present in the original resume.
- NEVER invent a number, percentage, or metric. You may only keep or rephrase a quantified value that is already present in the exact original bullet you are rewriting — if the original bullet has no number, the rewritten bullet must not introduce one.
- Every rewritten bullet's "sourceBulletIndex" must point at the specific original bullet it was derived from. Do not merge two unrelated original bullets into one rewritten bullet, and do not produce more rewritten bullets for a job than can be traced back to that job's original bullets/description.
- Every entry's "sourceJobIndex" must be the exact "Job [N]" index from the input — one reorderedExperience entry per original job, never inventing a job or splitting/merging jobs.
- REORDER experience entries so the most relevant ones come first.
- REWRITE bullets to emphasize achievements relevant to the target role — reframing and re-emphasizing is allowed, inventing new facts is not.
- REWRITE the summary to directly address the job requirements, using only facts already present elsewhere in the resume.
- REORDER skills to highlight the most relevant ones first.
- emphasizedSkills and keywordOptimizations must only include terms that are either already present in the candidate's resume, or that describe the job's own terminology being used to phrase the candidate's existing (real) experience — never a skill the candidate doesn't have.
- Use action verbs and industry-standard resume language.
${UNTRUSTED_CONTENT_SYSTEM_RULE}`;

const USER_PROMPT_TEMPLATE = (params: ResumeTailoringParams): string => {
  const experienceText = params.resumeExperience
    .map((exp, jobIndex) => {
      const bulletsText = exp.bullets.length
        ? exp.bullets.map((b, i) => `  [${i}] ${b}`).join('\n')
        : '  (no bullets extracted — description only)';
      return `Job [${jobIndex}]: ${exp.position} at ${exp.company}\nTechnologies: ${exp.technologies.join(', ')}\nDescription: ${exp.description}\nBullets:\n${bulletsText}`;
    })
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

Experience (each bullet is indexed — reference these indices in sourceBulletIndex):
${experienceText}

Skills: ${params.resumeSkills.join(', ')}
Technologies: ${params.resumeTechnologies.join(', ')}

Education:
${educationText}

Please tailor this resume for the above job vacancy. Follow all rules specified in the system prompt.`;
};

export class ResumeTailoringPromptBuilder implements PromptBuilder<ResumeTailoringParams> {
  readonly promptId = 'resume-tailoring';
  readonly currentVersion = '2.0.0';

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

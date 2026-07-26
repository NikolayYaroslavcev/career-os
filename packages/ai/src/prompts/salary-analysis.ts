import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

interface SalaryAnalysisParams {
  readonly jobTitle: string;
  readonly company?: string;
  readonly location: string;
  readonly experienceLevel: string;
  readonly technologies: readonly string[];
  readonly providedSalaryMin?: number;
  readonly providedSalaryMax?: number;
  readonly candidateExperienceYears: number;
  readonly candidateSkills: readonly string[];
}

const SYSTEM_PROMPT = `You are an expert compensation analyst with deep knowledge of tech industry salaries globally.
${UNTRUSTED_CONTENT_SYSTEM_RULE}

Respond with a JSON object:
{
  "marketMin": <number in USD monthly>,
  "marketMax": <number in USD monthly>,
  "marketMedian": <number in USD monthly>,
  "candidateEstimate": <number in USD monthly>,
  "confidence": <number 0-1>,
  "providedSalaryAssessment": "<underpaid|fair|overpaid|unknown>",
  "reasoning": "<detailed explanation>",
  "factors": [<string>]
}

Rules:
- Base estimates on market data for the specified location and experience level.
- Consider technology stack premium.
- If no salary is provided in the vacancy, mark assessment as "unknown".
- Provide monthly figures in USD.`;

function buildUserPrompt(params: SalaryAnalysisParams): string {
  const salaryInfo = params.providedSalaryMin !== undefined
    ? `Salary Range: $${params.providedSalaryMin} - $${params.providedSalaryMax ?? 'unspecified'} monthly`
    : 'Salary: Not provided in vacancy';

  return `Analyze the salary for this position:

## Position
- Title: ${wrapUntrustedContent('JOB_TITLE', params.jobTitle)}
- Company: ${params.company ? wrapUntrustedContent('COMPANY', params.company) : 'Not specified'}
- Location: ${params.location}
- Experience Level: ${params.experienceLevel}
- Technologies: ${params.technologies.join(', ')}
- ${salaryInfo}

## Candidate
- Years of Experience: ${params.candidateExperienceYears}
- Skills: ${wrapUntrustedContent('CANDIDATE_SKILLS', params.candidateSkills.join(', '))}

Provide your analysis as a JSON object.`;
}

export class SalaryAnalysisPromptBuilder implements PromptBuilder<SalaryAnalysisParams> {
  readonly promptId = 'salary-analysis';
  readonly currentVersion = '1.0.0';

  build(params: SalaryAnalysisParams): BuiltPrompt {
    const userPrompt = buildUserPrompt(params);

    return {
      system: SYSTEM_PROMPT,
      user: userPrompt,
      version: this.getVersion(),
    };
  }

  getVersion(): PromptVersion {
    return createPromptVersion(this.promptId, this.currentVersion, SYSTEM_PROMPT);
  }
}

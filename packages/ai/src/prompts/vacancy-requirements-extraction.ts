import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

export interface VacancyRequirementsExtractionParams {
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly companyIndustry?: string;
  readonly technologies: readonly string[];
  readonly requirements: readonly string[];
  readonly experienceLevel?: string;
}

export interface VacancyRequirementsResult {
  readonly seniority: string;
  readonly requiredSkills: readonly string[];
  readonly preferredSkills: readonly string[];
  readonly responsibilities: readonly string[];
  readonly atsKeywords: readonly string[];
  readonly technologies: readonly string[];
  readonly softSkills: readonly string[];
  readonly domain: string;
  readonly industry: string;
  readonly education: readonly string[];
  readonly certifications: readonly string[];
  readonly languageRequirements: readonly string[];
}

/**
 * Extracts the full requirement taxonomy a resume-tailoring pipeline needs
 * (ADR-031 Stage 2) — deliberately a separate prompt from
 * VacancyAnalysisPromptBuilder (packages/ai/src/prompts/vacancy-analysis.ts),
 * which is live in production for the recommendations/matching pipeline and
 * must not be touched by tailoring-specific schema changes.
 */
const SYSTEM_PROMPT = `You are an expert technical recruiter. Extract the structured requirement taxonomy from a job vacancy so it can be compared against a candidate's resume.

You must respond with a JSON object matching this exact schema:
{
  "seniority": "<junior|mid|senior|lead|executive>",
  "requiredSkills": [<string, skills/technologies explicitly required>],
  "preferredSkills": [<string, skills described as nice-to-have/bonus/preferred>],
  "responsibilities": [<string, one per distinct day-to-day responsibility or duty listed>],
  "atsKeywords": [<string, exact terms an ATS keyword scan would look for: job titles, tools, methodologies, certifications, standard industry phrases>],
  "technologies": [<string, all named tools/frameworks/platforms/languages>],
  "softSkills": [<string, communication/leadership/collaboration traits mentioned>],
  "domain": "<the functional domain, e.g. 'backend engineering', 'data analytics', 'product design'>",
  "industry": "<the company's industry, e.g. 'fintech', 'healthcare', 'e-commerce'>",
  "education": [<string, degree/field requirements, empty array if none stated>],
  "certifications": [<string, required or preferred certifications, empty array if none stated>],
  "languageRequirements": [<string, spoken/written language requirements, e.g. "English — fluent", empty array if none stated>]
}

Rules:
- Extract only what the vacancy text actually states or clearly implies — never invent a requirement that isn't there.
- requiredSkills vs preferredSkills: only split them if the vacancy distinguishes "required/must-have" from "nice-to-have/bonus/preferred". If it doesn't distinguish, put everything in requiredSkills and leave preferredSkills empty.
- atsKeywords should be the literal terms a keyword-matching ATS would scan for — prefer exact phrases from the posting over paraphrases.
- If a field has no basis in the text, return an empty array (for lists) or an empty string (for domain/industry) — do not guess.
${UNTRUSTED_CONTENT_SYSTEM_RULE}`;

function buildUserPrompt(params: VacancyRequirementsExtractionParams): string {
  const requirementsText = params.requirements.length
    ? `\nListed requirements:\n${params.requirements.map((r) => `- ${r}`).join('\n')}`
    : '';

  return `## Job Vacancy
Title: ${params.vacancyTitle}
Company: ${params.companyName}${params.companyIndustry ? ` (${params.companyIndustry})` : ''}
Experience Level: ${params.experienceLevel ?? 'Not specified'}
Technologies mentioned: ${params.technologies.join(', ') || 'None listed'}
${requirementsText}

Job Description:
${wrapUntrustedContent('VACANCY_DESCRIPTION', params.vacancyDescription)}

Extract the requirement taxonomy as a JSON object.`;
}

export class VacancyRequirementsPromptBuilder implements PromptBuilder<VacancyRequirementsExtractionParams> {
  readonly promptId = 'vacancy-requirements-extraction';
  readonly currentVersion = '1.0.0';

  build(params: VacancyRequirementsExtractionParams): BuiltPrompt {
    return {
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(params),
      version: this.getVersion(),
    };
  }

  getVersion(): PromptVersion {
    return createPromptVersion(this.promptId, this.currentVersion, SYSTEM_PROMPT);
  }
}

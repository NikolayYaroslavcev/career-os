import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

export interface StructuredResumeExtractionParams {
  readonly rawText: string;
}

const SYSTEM_PROMPT = `You are an expert resume analyst. Extract structured information from the provided resume text.

You must respond with a JSON object matching this exact schema:
{
  "summary": "<2-3 sentence professional summary>",
  "seniorityLevel": "<junior|mid|senior|lead|executive>",
  "totalYearsOfExperience": <number>,
  "skills": [<string>],
  "technologies": [<string>],
  "experience": [
    {
      "company": "<company name>",
      "position": "<job title>",
      "startDate": "<YYYY-MM-DD or YYYY-MM>",
      "endDate": "<YYYY-MM-DD or YYYY-MM or null if current>",
      "description": "<brief description of role and achievements>",
      "bullets": [<string, one per distinct achievement/responsibility line from the resume>],
      "technologies": [<string>]
    }
  ],
  "education": [
    {
      "institution": "<school name>",
      "degree": "<degree type>",
      "field": "<field of study>",
      "startDate": "<YYYY-MM-DD or YYYY-MM>",
      "endDate": "<YYYY-MM-DD or YYYY-MM or null if current>"
    }
  ],
  "certifications": [<string, one per named certification/license, empty array if none mentioned>],
  "languages": [<string, one per spoken/written language mentioned (e.g. "English — fluent"), empty array if none mentioned>]
}

Rules:
- Extract information exactly as stated in the resume. Do not infer or fabricate.
- If a field is not present in the resume, use a sensible default: empty string for text fields, empty array for lists, null for optional dates.
- seniorityLevel should be inferred from job titles, years of experience, and responsibilities described.
- totalYearsOfExperience should be calculated from the earliest start date to now.
- technologies should be a flat list of all technologies, tools, frameworks, and platforms mentioned.
- skills should capture soft skills, domain expertise, and certifications mentioned.
- For dates, use the format present in the resume. If only year-month is given, use that. If only year is given, use YYYY-01.
- description in experience should be a concise summary of the role, not a copy of the full bullet points.
- bullets should be the individual achievement/responsibility lines from the resume, extracted as close to verbatim as possible — do not paraphrase, merge, or invent bullets. If the resume describes a role in prose rather than bullet points, split it into separate sentences/clauses instead.
- certifications and languages should only include what is explicitly stated in the resume — do not infer a certification or language proficiency that isn't written.
${UNTRUSTED_CONTENT_SYSTEM_RULE}`;

function buildUserPrompt(params: StructuredResumeExtractionParams): string {
  return `Extract structured information from this resume:

${wrapUntrustedContent('RESUME_TEXT', params.rawText)}

Provide the extracted data as a JSON object.`;
}

export class StructuredResumeExtractionPromptBuilder implements PromptBuilder<StructuredResumeExtractionParams> {
  readonly promptId = 'structured-resume-extraction';
  readonly currentVersion = '1.2.0';

  build(params: StructuredResumeExtractionParams): BuiltPrompt {
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

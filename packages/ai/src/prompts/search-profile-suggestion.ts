import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

const MAX_RESUME_TEXT_LENGTH = 12_000;

export interface SearchProfileSuggestionParams {
  readonly resumeRawText: string;
}

const SYSTEM_PROMPT = `You are an expert career advisor. Read the resume text provided and infer what kind of job search the candidate should run.

Respond with a JSON object:
{
  "desiredPositions": [<string>],
  "technologies": [<string>],
  "experienceLevel": "<intern|junior|middle|senior|lead|principal|executive>",
  "remotePreference": "<remote|hybrid|onsite|unknown>",
  "confidence": <number 0-1>,
  "reasoning": "<brief explanation of how you derived these fields>"
}

Rules:
- "desiredPositions" should be 1-5 concise job titles that match the candidate's demonstrated experience (e.g. "Backend Engineer").
- "technologies" should be the most relevant, specific technologies/tools/languages found in the resume (max 15).
- "experienceLevel" must reflect the candidate's overall seniority based on years of experience and role titles.
- "remotePreference" must be "unknown" unless the resume text explicitly states or strongly implies a remote, hybrid, or onsite work preference.
- Only respond with the JSON object, no other text.
${UNTRUSTED_CONTENT_SYSTEM_RULE}`;

function buildUserPrompt(params: SearchProfileSuggestionParams): string {
  const resumeText = params.resumeRawText.slice(0, MAX_RESUME_TEXT_LENGTH);

  return `Analyze this resume text and infer the candidate's ideal job search profile:

## Resume Text
${wrapUntrustedContent('RESUME_TEXT', resumeText)}

Provide your analysis as a JSON object.`;
}

export class SearchProfileSuggestionPromptBuilder implements PromptBuilder<SearchProfileSuggestionParams> {
  readonly promptId = 'search-profile-suggestion';
  readonly currentVersion = '1.1.0';

  build(params: SearchProfileSuggestionParams): BuiltPrompt {
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
